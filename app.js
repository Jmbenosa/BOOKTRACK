var CURRENT_USER_ROLE = null; /* 'superadmin', 'librarian', or 'student' */
var CURRENT_USER_ID = null;
var loanDurationByCategory = {}; 
var librarianAccounts = [];

var TODAY = new Date(); 

function fmt(d) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric'
  });
}

function fmtInput(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function nowISO() {
  return new Date().toISOString();
}

function daysDiff(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000);
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showLoading(tbodyId, cols) {
  var el = document.getElementById(tbodyId);
  if (el) {
    el.innerHTML = '<tr><td colspan="' + cols + '" style="text-align:center;padding:32px;color:var(--text-muted);">Loading...</td></tr>';
  }
}


//Local cache (loaded from Supabase on login) 

var books   = [];
var members = [];
var issues  = [];

var currentIssueTab  = 'active';
var currentReportTab = 'issued';
var catChart, statusChart, rptCatChart, rptMonthlyChart;

//Book Categories 

var DEFAULT_CATEGORIES = ['Fiction','Science','History','Technology','Self-Help','Mathematics','Philosophy','Literature'];
var bookCategories = [];

function loadCategories() {
  try {
    var stored = localStorage.getItem('lms_categories');
    bookCategories = stored ? JSON.parse(stored) : DEFAULT_CATEGORIES.slice();
  } catch(e) {
    bookCategories = DEFAULT_CATEGORIES.slice();
  }
  renderAllCategoryDropdowns();
}

function saveCategories() {
  try { localStorage.setItem('lms_categories', JSON.stringify(bookCategories)); } catch(e) {}
}

function renderAllCategoryDropdowns() {
  var opts = bookCategories.map(function(c) {
    return '<option value="' + c + '">' + c + '</option>';
  }).join('');

  //Add/Edit Book modals
  var bCat = document.getElementById('b-cat');
  if (bCat) bCat.innerHTML = opts;
  var ebCat = document.getElementById('eb-cat');
  if (ebCat) ebCat.innerHTML = opts;

  //Books filter 
  var filterCat = document.getElementById('book-cat-filter');
  if (filterCat) {
    filterCat.innerHTML = '<option value="">All Categories</option>' + opts;
  }

  //Category manager list in Settings
  renderCategoryManagerList();
}

function renderCategoryManagerList() {
  var list = document.getElementById('cat-manager-list');
  if (!list) return;
  if (bookCategories.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">No categories yet.</div>';
    return;
  }
  list.innerHTML = bookCategories.map(function(c, idx) {
    return '<div class="cat-item">' +
      '<span class="cat-item-name">' + c + '</span>' +
      '<button class="icon-btn" style="color:var(--red)" onclick="deleteCategory(' + idx + ')" title="Remove category">&#128465;</button>' +
    '</div>';
  }).join('');
}

function addCategory() {
  var input = document.getElementById('new-cat-input');
  var name  = input.value.trim();
  if (!name) { showToast('Enter a category name', 'error'); return; }
  if (bookCategories.find(function(c) { return c.toLowerCase() === name.toLowerCase(); })) {
    showToast('Category already exists', 'error'); return;
  }
  bookCategories.push(name);
  //Ensure loan duration is initialized for the new category 
  if (!loanDurationByCategory[name]) loanDurationByCategory[name] = 14;
  saveCategories();
  saveLoanDurations();
  renderAllCategoryDropdowns();
  input.value = '';
  renderCategoryLoanDurations();
  showToast('Category "' + name + '" added!', 'success');
}

function deleteCategory(idx) {
  var name = bookCategories[idx];
  if (!confirm('Remove category "' + name + '"? Books assigned to it will keep their existing category label.')) return;
  bookCategories.splice(idx, 1);
  try { delete loanDurationByCategory[name]; } catch(e) {}
  saveCategories();
  saveLoanDurations();
  renderAllCategoryDropdowns();
  renderCategoryLoanDurations();
  showToast('Category removed', 'success');
}

function resetCategories() {
  if (!confirm('Reset to default categories? Custom categories will be removed.')) return;
  bookCategories = DEFAULT_CATEGORIES.slice();
  var newDur = {};
  bookCategories.forEach(function(cat) { newDur[cat] = 14; });
  loanDurationByCategory = newDur;
  saveCategories();
  saveLoanDurations();
  renderAllCategoryDropdowns();
  renderCategoryLoanDurations();
  showToast('Categories reset to defaults', 'success');
}


//Loan Duration by Category 

function loadLoanDurations() {
  try {
    var stored = localStorage.getItem('lms_loan_durations');
    loanDurationByCategory = stored ? JSON.parse(stored) : {};
    bookCategories.forEach(function(cat) {
      if (!loanDurationByCategory[cat]) {
        loanDurationByCategory[cat] = 14; // default to 14 days load duration for books
      }
    });
    renderCategoryLoanDurations();
  } catch(e) {
    console.error('Error loading loan durations:', e);
  }
}

function saveLoanDurations() {
  try {
    localStorage.setItem('lms_loan_durations', JSON.stringify(loanDurationByCategory));
    showToast('Loan durations saved!', 'success');
  } catch(e) {
    console.error('Error saving loan durations:', e);
  }
}

function renderCategoryLoanDurations() {
  var container = document.getElementById('category-loan-durations');
  if (!container) return;
  
  container.innerHTML = bookCategories.map(function(cat) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--green-lighter)">' +
      '<label style="min-width:100px;font-size:12px;font-weight:600">' + cat + ':</label>' +
      '<input type="number" style="width:60px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px" ' +
        'value="' + (loanDurationByCategory[cat] || 14) + '" ' +
        'onchange="loanDurationByCategory[\'' + cat.replace(/\'/g, "\\'") + '\'] = parseInt(this.value); saveLoanDurations()" ' +
        'min="1" max="365" />' +
      '<span style="font-size:11px;color:var(--text-muted)">days</span>' +
    '</div>';
  }).join('');
}

function mapBook(row) {
  return {
    id:        parseInt(row.id, 10),
    isbn:      row.isbn      || '',
    title:     row.title     || '',
    author:    row.author    || '',
    category:  row.category  || '',
    shelf:     row.shelf     || '',
    copies:    row.copies    || 0,
    available: row.available || 0,
    status:    row.status    || 'Available',
    isLost:    row.is_lost   || false,
    isDamaged: row.is_damaged || false
  };
}

function mapMember(row) {
  return {
    id:          parseInt(row.id, 10),
    memberRef:   row.member_ref || row.memberRef || null,
    name:        row.name         || '',
    email:       row.email        || '',
    phone:       row.phone        || '',
    type:        row.type         || 'Student',
    joinDate:    row.join_date    || '',
    sid:         row.sid          || '',
    grade:       row.grade        || '',
    section:     row.section      || '',
    active:      row.active       || 0,
    overdue:     row.overdue      || 0,
    totalIssued: row.total_issued || 0,
    address:     row.address      || ''
  };
}

function mapIssue(row) {
  return {
    id:         row.id,
    bookId:     parseInt(row.book_id, 10)  || 0,
    bookTitle:  row.book_title   || '',
    author:     row.author       || '',
    memberId:   parseInt(row.member_id, 10) || 0,
    memberName: row.member_name  || '',
    issueDate:  row.issue_date   || '',
    dueDate:    row.due_date     || '',
    status:     row.status       || 'Active',
    renewals:   row.renewals     || 0,
    returnDate: row.return_date  || '',
    condition:  row.condition    || 'Good'
  };
}

function normalizeCachedBook(row) {
  return (row && row.isLost !== undefined) ? row : mapBook(row);
}

function normalizeCachedMember(row) {
  return (row && row.joinDate !== undefined) ? row : mapMember(row);
}

function normalizeCachedIssue(row) {
  return (row && row.issueDate !== undefined) ? row : mapIssue(row);
}


//Load all data 

async function loadAllData() {
  try {
    var response = await fetch('api/data.php', { method: 'GET' });
    var rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      throw new Error('Empty server response (status ' + response.status + ')');
    }

    var data = JSON.parse(rawText);
    if (!data.success) {
      throw new Error(data.message || 'Failed to load library data');
    }
    var serverBooks   = (data.books || []).map(mapBook);
    var serverMembers = (data.members || []).map(mapMember);
    var serverIssues  = (data.issues || []).map(mapIssue);

    books = serverBooks;
    members = serverMembers;
    issues = serverIssues;
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Could not load data: ' + (err.message || 'Server unreachable') + '. Falling back to local cache.', 'error');

    var stored = localStorage.getItem('lms_data');
    if (stored) {
      try {
        var data = JSON.parse(stored);
        books = (data.books || []).map(normalizeCachedBook);
        members = (data.members || []).map(normalizeCachedMember);
        issues = (data.issues || []).map(normalizeCachedIssue);
      } catch (parseError) {
        books = [];
        members = [];
        issues = [];
      }
    } else {
      books = [];
      members = [];
      issues = [];
    }
  }
}

//Helper function to save data to localStorage (use MySQL in production)
function saveAllData() {
  try {
    localStorage.setItem('lms_data', JSON.stringify({books, members, issues}));
  } catch(e) {
    console.error('Error saving data:', e);
  }
}

async function loadLibrarians() {
  try {
    var url = 'api/librarians.php';
    var response = await fetch(url, { method: 'GET' });
    var rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      throw new Error('Empty librarian response (status ' + response.status + ')');
    }

    var data = JSON.parse(rawText);
    if (!data.success) {
      throw new Error(data.message || 'Failed to load librarian accounts');
    }

    var serverLibrarians = data.librarians || [];
    var migrated = false;
    var stored = localStorage.getItem('lms_librarians');

    if (stored) {
      try {
        var storedLibrarians = JSON.parse(stored) || [];
        if (Array.isArray(storedLibrarians) && storedLibrarians.length > 0) {
          var existingEmails = new Set(serverLibrarians.map(function(lib) { return lib.email; }));
          for (var i = 0; i < storedLibrarians.length; i++) {
            var lib = storedLibrarians[i];
            if (!lib || !lib.email || !lib.name || !lib.password) continue;
            if (existingEmails.has(lib.email)) continue;

            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: lib.name, email: lib.email, password: lib.password })
            });

            existingEmails.add(lib.email);
            migrated = true;
          }
          if (migrated) {
            localStorage.removeItem('lms_librarians');
          }
        }
      } catch (storageError) {
        console.warn('Could not migrate stored librarians:', storageError);
      }
    }

    if (migrated) {
      var refreshed = await fetch(url, { method: 'GET' });
      var refreshedText = await refreshed.text();
      if (refreshedText && refreshedText.trim()) {
        var refreshedData = JSON.parse(refreshedText);
        if (refreshedData.success) {
          serverLibrarians = refreshedData.librarians || [];
        }
      }
    }

    librarianAccounts = serverLibrarians;
    renderLibrarianList();
  } catch (err) {
    console.error('Error loading librarians:', err);
    librarianAccounts = [];
    renderLibrarianList();
    showToast('Could not load librarian accounts from server.', 'error');
  }
}


// Auto-mark overdue issues 
async function checkAndUpdateOverdue() {
  TODAY = new Date(); // keep TODAY in sync
  var now = TODAY;
  var toUpdate = issues.filter(function(i) {
    if (i.status !== 'Active' && i.status !== 'Renewed') return false;
    var due = new Date(i.dueDate);
    if (i.dueDate && i.dueDate.length <= 10) {
      due = new Date(i.dueDate + 'T23:59:59');
    }
    return due < now;
  });

  for (var i = 0; i < toUpdate.length; i++) {
    var issue = toUpdate[i];
    try {
      //Update issue status to Overdue in database 
      await fetch('api/issues.php', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:     issue.id,
          status: 'Overdue'
        })
      });

      // Update member overdue count 
      var member = members.find(function(m) { return m.id === issue.memberId; });
      if (member) {
        await fetch('api/members.php', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id:      member.id,
            overdue: member.overdue + 1
          })
        });
      }
    } catch (err) {
      console.error('Error updating overdue for issue ' + issue.id + ':', err);
    }
  }

  if (toUpdate.length > 0) {
    await loadAllData();
    updateStats();
    if (document.getElementById('page-issues').classList.contains('active')) renderIssuesTable();
    if (document.getElementById('page-dashboard').classList.contains('active')) renderActiveIssuesList();
  }
}


// Navigation 

function navigate(page, btn) {
  if (CURRENT_USER_ROLE === 'superadmin' && ['books','members','issues','settings'].includes(page)) {
    showToast('Super Admin can only access dashboard, reports, and librarian management.', 'error');
    return;
  }

  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.remove('active');
  });
  document.getElementById('page-' + page).classList.add('active');
  if (btn) btn.classList.add('active');
  closeSidebar();
  //Re-check overdue on every navigation so counters stay accurate 
  checkAndUpdateOverdue().then(function() {
    if (page === 'books')   renderBooksTable();
    if (page === 'members') renderMembersTable();
    if (page === 'issues')  renderIssuesTable();
    if (page === 'reports') { populateReportMemberFilter(); renderReportTable(); initReportCharts(); }
    if (page === 'settings') { renderCategoryManagerList(); renderCategoryLoanDurations(); }
  });
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}


// Login / Auth

function showRoleSelection() {
  document.getElementById('role-selection-view').style.display = 'block';
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('student-search-view').style.display = 'none';
  document.getElementById('forgot-view').style.display = 'none';
}

function showLoginForRole(role) {
  CURRENT_USER_ROLE = role;
  document.getElementById('role-selection-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'block';
  document.getElementById('student-search-view').style.display = 'none';
  document.getElementById('forgot-view').style.display = 'none';
  
  var titles = {
    'superadmin': '👑 Super Admin Login',
    'librarian': '📚 Librarian Login',
    'student': '👨‍🎓 Student Login'
  };
  
  var subtitles = {
    'superadmin': 'Sign in to manage system and librarian accounts',
    'librarian': 'Sign in to manage library operations',
    'student': 'Sign in to access library features'
  };
  
  document.getElementById('login-title').textContent = titles[role] || 'Login';
  document.getElementById('login-subtitle').textContent = subtitles[role] || 'Sign in to access the system';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-user').focus();
}

async function showStudentSearch() {
  document.getElementById('role-selection-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('student-search-view').style.display = 'block';
  document.getElementById('forgot-view').style.display = 'none';
  document.getElementById('student-search-name').value = '';
  document.getElementById('student-results').style.display = 'none';
  document.getElementById('student-no-results').style.display = 'none';
  document.getElementById('student-search-name').focus();

  try {
    await loadAllData();
    renderMembersTable();
  } catch (e) {
    console.warn('Could not refresh data for student search:', e);
  }
}

function togglePass() {
  var p = document.getElementById('login-pass');
  p.type = (p.type === 'password') ? 'text' : 'password';
}

function showForgot() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('forgot-view').style.display = 'block';
}

function showLogin() {
  document.getElementById('forgot-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'block';
  document.getElementById('forgot-success').style.display = 'none';
}

function sendReset() {
  var email = document.getElementById('forgot-email').value.trim();
  if (!email || !isValidEmail(email)) { showToast('Please enter a valid email address', 'error'); return; }
  
  var btn = document.querySelector('[onclick="sendReset()"]');
  var originalText = btn ? btn.textContent : 'Send Reset Link';
  if (btn) btn.disabled = true;
  
  // Send email via backend 
  fetch('api/reset_password.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  })
  .then(function(response) { return response.json(); })
  .then(function(data) {
    if (data.success) {
      document.getElementById('forgot-success').style.display = 'block';
      document.getElementById('forgot-email').value = '';
      showToast('Reset link sent to your email!', 'success');
    } else {
      showToast(data.message || 'Failed to send reset link', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  })
  .catch(function(error) {
    console.error('Error sending reset email:', error);
    showToast('Error sending email. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  });
}

// Email validation 
function isValidEmail(email) {
  var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

async function doLogin() {
  var email = document.getElementById('login-user').value.trim();
  var pass  = document.getElementById('login-pass').value;
  
  if (!email || !pass) {
    showToast('Please enter email and password', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  var loginButton = document.querySelector('[onclick="doLogin()"]');
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
  }

  try {
    var authUrl = 'api/auth.php';
    var response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass, role: CURRENT_USER_ROLE })
    });

    var rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      throw new Error('Empty server response (status ' + response.status + ')');
    }

    var data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error('Invalid JSON response: ' + rawText);
    }

    if (!data.success) {
      showToast(data.message || 'Incorrect email or password', 'error');
      return;
    }

    CURRENT_USER_ID = data.email;
    var roleLabel = data.role === 'superadmin' ? 'Super Admin' : data.role === 'librarian' ? 'Librarian' : 'Student';
    showToast(roleLabel + ' authenticated!', 'success');
    await loadAllData();
    loadCategories();
    loadLoanDurations();
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    updateSidebarForRole(data.role);
    sessionStorage.setItem('lms_logged_in', 'true');
    sessionStorage.setItem('lms_last_active', Date.now().toString());
    sessionStorage.setItem('lms_role', data.role);
    await checkAndUpdateOverdue();
    initDashboard();
    startInactivityTimer();
  } catch (error) {
    console.error('Login error:', error);
    showToast(error.message || 'Login failed. Please try again.', 'error');
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Sign In';
    }
  }
}

function searchStudentBorrowingInfo() {
  var searchName = document.getElementById('student-search-name').value.trim().toLowerCase();
  if (!searchName) {
    document.getElementById('student-results').style.display = 'none';
    document.getElementById('student-no-results').style.display = 'none';
    return;
  }

  var foundMember = members.find(function(m) {
    return m.type === 'Student' && m.name.toLowerCase().includes(searchName);
  });

  if (!foundMember) {
    document.getElementById('student-results').style.display = 'none';
    document.getElementById('student-no-results').style.display = 'block';
    return;
  }

  var memberIssues = issues.filter(function(i) {
    return i.memberId === foundMember.id && (i.status === 'Active' || i.status === 'Renewed' || i.status === 'Overdue');
  });

  var tbody = document.getElementById('student-results-tbody');
  if (memberIssues.length === 0) {
    document.getElementById('student-results').style.display = 'none';
    document.getElementById('student-no-results').style.display = 'block';
  } else {
    document.getElementById('student-results').style.display = 'block';
    document.getElementById('student-no-results').style.display = 'none';
    
    tbody.innerHTML = memberIssues.map(function(i) {
      var diff = daysDiff(TODAY, new Date(i.dueDate));
      var daysHtml = diff < 0 
        ? '<span class="days-left-over">' + Math.abs(diff) + 'd overdue</span>'
        : diff === 0 
        ? '<span class="days-left-warn">Due today</span>'
        : '<span class="days-left-ok">' + diff + 'd left</span>';
      
      var statusClass = i.status === 'Overdue' ? 'badge-overdue' : 'badge-active';
      return '<tr>' +
        '<td>' + i.bookTitle + '</td>' +
        '<td>' + i.author + '</td>' +
        '<td style="font-size:12px">' + fmt(i.issueDate) + '</td>' +
        '<td style="font-size:12px">' + fmt(i.dueDate) + '</td>' +
        '<td>' + daysHtml + '</td>' +
        '<td><span class="badge ' + statusClass + '">&#9679; ' + i.status + '</span></td>' +
      '</tr>';
    }).join('');
  }
}

function doLogout() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  books = []; members = []; issues = [];
  CURRENT_USER_ROLE = null;
  CURRENT_USER_ID = null;
  sessionStorage.removeItem('lms_logged_in');
  sessionStorage.removeItem('lms_last_active');
  sessionStorage.removeItem('lms_role');
  clearInactivityTimer();
  showRoleSelection();
}

function updateSidebarForRole(role) {
  var roleNames = {
    'superadmin': 'Super Admin',
    'librarian':  'Librarian',
    'student':    'Student'
  };

  var roleLabel = roleNames[role] || 'User';
  setText('user-name', roleLabel);
  setText('user-role', roleLabel);
  setText('topbar-username', roleLabel);

  var sidebarBottom = document.querySelector('.sidebar-bottom');
  var existingMgmt = document.getElementById('nav-librarian-mgmt');
  var navBooks = document.getElementById('nav-books');
  var navMembers = document.getElementById('nav-members');
  var navIssues = document.getElementById('nav-issues');
  var navReports = document.getElementById('nav-reports');
  var navSettings = document.getElementById('nav-settings');
  var pageBooks = document.getElementById('page-books');
  var pageMembers = document.getElementById('page-members');
  var pageIssues = document.getElementById('page-issues');
  var pageReports = document.getElementById('page-reports');
  var pageSettings = document.getElementById('page-settings');
  var activeIssuesPanel = document.getElementById('dashboard-active-issues-panel');
  var topbarOverdue = document.getElementById('topbar-overdue-badge');
  var dashActions = document.getElementById('dashboard-actions');
  var dashQuickActions = document.getElementById('dashboard-quick-actions');

  if (role === 'superadmin') {
    if (navBooks) navBooks.style.display = 'none';
    if (navMembers) navMembers.style.display = 'none';
    if (navIssues) navIssues.style.display = 'none';
    if (navSettings) navSettings.style.display = 'none';
    if (pageBooks) pageBooks.style.display = 'none';
    if (pageMembers) pageMembers.style.display = 'none';
    if (pageIssues) pageIssues.style.display = 'none';
    if (pageSettings) pageSettings.style.display = 'none';
    if (activeIssuesPanel) activeIssuesPanel.style.display = 'none';
    if (topbarOverdue) topbarOverdue.style.display = '';
    if (dashActions) dashActions.style.display = 'none';
    if (dashQuickActions) dashQuickActions.style.display = 'none';

    if (!existingMgmt && sidebarBottom) {
      var li = document.createElement('button');
      li.id = 'nav-librarian-mgmt';
      li.className = 'nav-item';
      li.innerHTML = '<span class="nav-icon">🔐</span> Account Management';
      li.onclick = function() { openModal('librarian-management-modal'); };
      sidebarBottom.parentNode.insertBefore(li, sidebarBottom);
    }
  } else {
    if (navBooks) navBooks.style.display = '';
    if (navMembers) navMembers.style.display = '';
    if (navIssues) navIssues.style.display = '';
    if (navReports) navReports.style.display = '';
    if (navSettings) navSettings.style.display = '';
    if (pageBooks) pageBooks.style.display = '';
    if (pageMembers) pageMembers.style.display = '';
    if (pageIssues) pageIssues.style.display = '';
    if (pageReports) pageReports.style.display = '';
    if (pageSettings) pageSettings.style.display = '';
    if (activeIssuesPanel) activeIssuesPanel.style.display = '';
    if (topbarOverdue) topbarOverdue.style.display = '';
    if (dashActions) dashActions.style.display = '';
    if (dashQuickActions) dashQuickActions.style.display = '';

    if (existingMgmt) {
      existingMgmt.remove();
    }
  }
}


// Session / Inactivity 

var inactivityTimer = null;
var INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes in ms 

function startInactivityTimer() {
  clearInactivityTimer();
  inactivityTimer = setTimeout(function() {
    showToast('Session expired due to inactivity. Please log in again.', 'error');
    setTimeout(doLogout, 2000);
  }, INACTIVITY_LIMIT);
}

function clearInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function resetInactivityTimer() {
  sessionStorage.setItem('lms_last_active', Date.now().toString());
  startInactivityTimer();
}

// Track user activity — any mouse move, click, or key press resets timer 
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(function(evt) {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Restore session on page refresh 
async function restoreSession() {
  var loggedIn   = sessionStorage.getItem('lms_logged_in');
  var lastActive = parseInt(sessionStorage.getItem('lms_last_active') || '0');
  var role       = sessionStorage.getItem('lms_role');
  var elapsed    = Date.now() - lastActive;

  if (loggedIn === 'true' && elapsed < INACTIVITY_LIMIT && role) {
    showToast('Restoring session...', 'success');
    CURRENT_USER_ROLE = role;
    await loadAllData();
    loadCategories();
    loadLoanDurations();
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    updateSidebarForRole(role);
    await checkAndUpdateOverdue();
    initDashboard();
    startInactivityTimer();
  } else if (loggedIn === 'true') {
    // Session expired while away 
    sessionStorage.removeItem('lms_logged_in');
    sessionStorage.removeItem('lms_last_active');
    sessionStorage.removeItem('lms_role');
    showToast('Session expired. Please log in again.', 'error');
    showRoleSelection();
  } else {
    showRoleSelection();
  }
}


// Dashboard 

function initDashboard() {
  var now = new Date();
  setText('dash-date',
    now.toLocaleDateString('en-US', {
      weekday: 'long',
      month:   'long',
      day:     'numeric',
      year:    'numeric'
    }) + ' \u2014 Overview of library operations'
  );
  updateStats();
  renderActiveIssuesList();
  initDashCharts();
}

function updateStats() {
  var totalCopies   = books.reduce(function(s, b) { return s + b.copies; }, 0);
  var overdueCount  = issues.filter(function(i) { return i.status === 'Overdue'; }).length;
  var activeCount   = issues.filter(function(i) { return i.status === 'Active' || i.status === 'Renewed'; }).length;
  var returnedCount = issues.filter(function(i) { return i.status === 'Returned'; }).length;

  setText('stat-total-books',  totalCopies);
  setText('stat-titles',       books.length + ' titles');
  
  var currentlyIssued = issues.filter(function(i) { 
    return i.status === 'Active' || i.status === 'Renewed' || i.status === 'Overdue'; 
  }).length;

  setText('stat-issued',       currentlyIssued);
  setText('stat-overdue',      overdueCount);
  setText('stat-members',      members.length);
  setText('stat-students',     members.filter(function(m) { return m.type === 'Student'; }).length + ' students');
  setText('topbar-overdue',    overdueCount);
  setText('nav-overdue-badge', overdueCount);
  setText('mo-students',       members.filter(function(m) { return m.type === 'Student'; }).length);
  setText('mo-faculty',        members.filter(function(m) { return m.type === 'Faculty'; }).length);
  setText('ir-active-count',   activeCount);
  setText('ir-overdue-count',  overdueCount);
  setText('ir-returned-count', returnedCount);
  setText('tab-active-count',  activeCount);
  setText('tab-overdue-count', overdueCount);
  setText('tab-returned-count', returnedCount);
  
  // Sync report counts 
  setText('rpt-tab-issued',    currentlyIssued);
  setText('rpt-tab-overdue',   overdueCount);
  setText('rpt-tab-damaged',   books.filter(function(b) { return b.isLost || b.isDamaged; }).length);
  setText('rpt-tab-history',   issues.length);
  setText('books-count-sub',   books.length + ' books in inventory');
  setText('members-count-sub', members.length + ' registered members');
}

function renderActiveIssuesList() {
  var list   = document.getElementById('active-issues-list');
  var active = issues.filter(function(i) { 
    return i.status === 'Active' || i.status === 'Renewed' || i.status === 'Overdue'; 
  }).slice(0, 5);

  if (active.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">No active issues</div>';
    return;
  }

  list.innerHTML = active.map(function(i) {
    return '<div class="issue-item ' + (i.status === 'Overdue' ? 'overdue' : '') + '">' +
      '<div>' +
        '<div class="issue-book">'   + i.bookTitle + '</div>' +
        '<div class="issue-member">' + i.memberName + ' &bull; Due: ' + fmt(i.dueDate) + '</div>' +
      '</div>' +
      '<span class="badge ' + (i.status === 'Overdue' ? 'badge-overdue' : 'badge-active') + '">&#9679; ' + i.status + '</span>' +
    '</div>';
  }).join('');
}

function initDashCharts() {
  var cats = {};
  books.forEach(function(b) {
    cats[b.category] = (cats[b.category] || 0) + b.copies;
  });

  var avail   = books.reduce(function(s, b) { return s + b.available; }, 0);
  var issuedB = issues.filter(function(i) { 
    return i.status === 'Active' || i.status === 'Renewed' || i.status === 'Overdue'; 
  }).length;
  
  var lost = books.filter(function(b) { return b.isLost; }).length;
  var dmg  = books.filter(function(b) { return b.isDamaged; }).length;

  var catLabels = Object.keys(cats);
  var catValues = Object.values(cats);

  if (catChart) catChart.destroy();
  catChart = new Chart(document.getElementById('cat-chart'), {
    type: 'bar',
    data: {
      labels: catLabels.length > 0 ? catLabels : ['No data'],
      datasets: [{
        data: catValues.length > 0 ? catValues : [0],
        backgroundColor: catLabels.map(function() { return '#2ec4a0'; }),
        borderWidth: 0,
        borderRadius: 5
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { color: '#9bb5ad' } },
        x: { grid: { display: false }, ticks: { color: '#9bb5ad' } }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('status-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Available', 'Issued', 'Lost', 'Damaged'],
      datasets: [{
        data: [avail || 0, issuedB || 0, lost || 0, dmg || 0],
        backgroundColor: ['#2ec4a0', '#3b82f6', '#9ca3af', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, font: { size: 11 } }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}


// Books
function renderBooksTable() {
  var q    = (document.getElementById('book-search')        || { value: '' }).value.toLowerCase();
  var cat  = (document.getElementById('book-cat-filter')    || { value: '' }).value;
  var stat = (document.getElementById('book-status-filter') || { value: '' }).value;

  var filtered = books.filter(function(b) {
    var mQ = !q    || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.includes(q);
    var mC = !cat  || b.category === cat;
    var mS = !stat || (stat === 'Lost' ? b.isLost : stat === 'Damaged' ? b.isDamaged : b.status === stat);
    return mQ && mC && mS;
  });

  setText('books-count-sub', books.length + ' books in inventory \u2022 ' + filtered.length + ' shown');

  if (filtered.length === 0) {
    document.getElementById('books-tbody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No books found. Click <strong>+ Add New Book</strong> to get started.</td></tr>';
    return;
  }

  document.getElementById('books-tbody').innerHTML = filtered.map(function(b) {
    var statusClass = b.isLost ? 'badge-lost' : b.isDamaged ? 'badge-damaged' : b.available > 0 ? 'badge-available' : 'badge-issued';
    var statusText  = b.isLost ? 'Lost'       : b.isDamaged ? 'Damaged'       : b.available > 0 ? 'Available'       : 'Issued';
    var issueBtn    = b.available > 0
      ? '<button class="btn btn-sm btn-outline" onclick="quickIssue(' + b.id + ')">Issue</button>'
      : '<button class="btn btn-sm btn-outline" disabled style="opacity:.4">Issue</button>';

    return '<tr>' +
      '<td class="td-isbn">' + b.isbn + '</td>' +
      '<td><div class="td-title">' + b.title + '</div></td>' +
      '<td>' + b.author + '</td>' +
      '<td>' + b.category + '</td>' +
      '<td>' + b.shelf    + '</td>' +
      '<td>' + b.copies   + '</td>' +
      '<td class="' + (b.available === 0 ? 'zero-count' : 'available-count') + '">' + b.available + '</td>' +
      '<td><span class="badge ' + statusClass + '">&#9679; ' + statusText + '</span></td>' +
      '<td><div class="action-btns">' +
        issueBtn +
        '<button class="icon-btn edit" onclick="openEditBookModal(' + b.id + ')" title="Edit">&#9998;</button>' +
        '<button class="icon-btn" onclick="deleteBook(' + b.id + ')" title="Delete">&#128465;</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

async function addBook() {
  var title  = document.getElementById('b-title').value.trim();
  var author = document.getElementById('b-author').value.trim();
  var isbn   = document.getElementById('b-isbn').value.trim();
  if (!title || !author || !isbn) { showToast('Please fill required fields', 'error'); return; }

  var copies = parseInt(document.getElementById('b-copies').value) || 1;

  try {
    var response = await fetch('api/books.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isbn:     isbn,
        title:    title,
        author:   author,
        category: document.getElementById('b-cat').value,
        shelf:    document.getElementById('b-shelf').value || 'Z-01',
        copies:   copies,
        available: copies
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to add book', 'error');
      return;
    }

    closeModal('add-book-modal');
    ['b-isbn', 'b-shelf', 'b-title', 'b-author'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('b-copies').value = '1';

    await loadAllData();
    renderBooksTable();
    updateStats();
    initDashCharts();
    showToast('Book added successfully!', 'success');
  } catch (err) {
    console.error('Error adding book:', err);
    showToast('Error adding book', 'error');
  }
}

async function deleteBook(id) {
  if (!confirm('Delete this book?')) return;

  try {
    var response = await fetch('api/books.php', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to delete book', 'error');
      return;
    }

    await loadAllData();
    renderBooksTable();
    updateStats();
    showToast('Book deleted', 'success');
  } catch (err) {
    console.error('Error deleting book:', err);
    showToast('Error deleting book', 'error');
  }
}

function quickIssue(id) {
  openIssueModal(id);
}

function openEditBookModal(id) {
  var b = books.find(function(b) { return b.id === id; });
  if (!b) return;
  document.getElementById('eb-id').value     = b.id;
  document.getElementById('eb-isbn').value   = b.isbn;
  document.getElementById('eb-title').value  = b.title;
  document.getElementById('eb-author').value = b.author;
  document.getElementById('eb-cat').value    = b.category;
  document.getElementById('eb-shelf').value  = b.shelf;
  document.getElementById('eb-copies').value = b.copies;
  var statusVal = b.isLost ? 'Lost' : b.isDamaged ? 'Damaged' : b.status;
  document.getElementById('eb-status').value = statusVal;
  openModal('edit-book-modal');
}

async function saveEditBook() {
  var id     = parseInt(document.getElementById('eb-id').value);
  var title  = document.getElementById('eb-title').value.trim();
  var author = document.getElementById('eb-author').value.trim();
  var isbn   = document.getElementById('eb-isbn').value.trim();
  if (!title || !author || !isbn) { showToast('Please fill required fields', 'error'); return; }

  var statusVal = document.getElementById('eb-status').value;
  var copies    = parseInt(document.getElementById('eb-copies').value) || 1;
  var book      = books.find(function(b) { return b.id === id; });
  if (!book) return;

  try {
    var response = await fetch('api/books.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:       id,
        isbn:     isbn,
        title:    title,
        author:   author,
        category: document.getElementById('eb-cat').value,
        shelf:    document.getElementById('eb-shelf').value,
        copies:   copies,
        status:   statusVal,
        is_lost:  statusVal === 'Lost' ? 1 : 0,
        is_damaged: statusVal === 'Damaged' ? 1 : 0
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to update book', 'error');
      return;
    }

    closeModal('edit-book-modal');
    await loadAllData();
    renderBooksTable();
    updateStats();
    initDashCharts();
    showToast('Book updated successfully!', 'success');
  } catch (err) {
    console.error('Error updating book:', err);
    showToast('Error updating book', 'error');
  }
}


// Members

function renderMembersTable() {
  var q    = (document.getElementById('member-search')      || { value: '' }).value.toLowerCase();
  var type = (document.getElementById('member-type-filter') || { value: '' }).value;

  var filtered = members.filter(function(m) {
    var idStr = (m.memberRef || m.id || '').toString().toLowerCase();
    var mQ = !q    || m.name.toLowerCase().includes(q) || idStr.includes(q);
    var mT = !type || m.type === type;
    return mQ && mT;
  });

  if (filtered.length === 0) {
    document.getElementById('members-tbody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No members found. Click <strong>+ Register Member</strong> to get started.</td></tr>';
    return;
  }

  document.getElementById('members-tbody').innerHTML = filtered.map(function(m) {
    var studentInfo = m.type === 'Student'
      ? '<div class="td-sub" style="margin-top:4px">ID: ' + (m.sid || '') + ' ' + (m.grade || '') + ' ' + (m.section || '') + '</div>'
      : '';

    var displayId = m.memberRef || m.id;
    return '<tr>' +
      '<td><span class="link">' + displayId + '</span></td>' +
      '<td><div class="td-title">' + m.name + '</div><div class="td-sub">' + m.email + ' &bull; ' + m.phone + '</div></td>' +
      '<td><span class="badge badge-' + m.type.toLowerCase() + '">' + m.type + '</span>' + studentInfo + '</td>' +
      '<td>' + fmt(m.joinDate) + '</td>' +
      '<td style="color:' + (m.active  > 0 ? 'var(--green-mid)' : 'var(--text-muted)') + ';font-weight:600">' + m.active  + '</td>' +
      '<td style="color:' + (m.overdue > 0 ? 'var(--red)'       : 'var(--text-muted)') + ';font-weight:600">' + m.overdue + '</td>' +
      '<td>' + m.totalIssued + '</td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-sm btn-outline" onclick="openMemberHistory(\'' + (m.id) + '\')">History</button>' +
        '<button class="btn btn-sm btn-outline" onclick="openIssueModal(null,\'' + (m.id) + '\')">Issue</button>' +
        '<button class="icon-btn edit" onclick="openEditMemberModal(\'' + (m.id) + '\')">&#9998;</button>' +
        '<button class="icon-btn" onclick="deleteMember(\'' + (m.id) + '\')">&#128465;</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

async function registerMember() {
  var name  = document.getElementById('m-name').value.trim();
  var email = document.getElementById('m-email').value.trim();
  if (!name || !email) { showToast('Please fill required fields', 'error'); return; }

  if (!isValidEmail(email)) { showToast('Please enter a valid email address', 'error'); return; }

  try {
    var response = await fetch('api/members.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:    name,
        email:   email,
        phone:   document.getElementById('m-phone').value,
        type:    document.getElementById('m-type').value,
        address: document.getElementById('m-address').value,
        sid:     document.getElementById('m-sid').value,
        grade:   document.getElementById('m-grade').value,
        section: document.getElementById('m-section').value
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to register member', 'error');
      return;
    }

    closeModal('register-member-modal');
    ['m-name', 'm-email', 'm-phone', 'm-address', 'm-sid', 'm-grade', 'm-section'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });

    await loadAllData();
    renderMembersTable();
    updateStats();
    showToast('Member registered successfully!', 'success');
  } catch (err) {
    console.error('Error registering member:', err);
    showToast('Error registering member', 'error');
  }
}

function triggerExcelImport() {
  document.getElementById('excel-import').click();
}

async function handleExcelImport(event) {
  var file = event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('Only CSV files are supported for import. Please save your Excel file as CSV and try again.', 'error');
    event.target.value = '';
    return;
  }

  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var text = e.target.result;
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      var lines = text.split(/\r\n|\n|\r/);
      var importedCount = 0;
      var startIndex = 0;
      if (lines.length > 0) {
        var firstCell = lines[0].split(',')[0].trim().toLowerCase().replace(/^"(.*)"$/, '$1');
        if (firstCell === 'name' || firstCell === 'full name' || firstCell === 'student name' || firstCell === 'member name') {
          startIndex = 1;
        }
      }

      for (var i = startIndex; i < lines.length; i++) {
        var line = lines[i];
        if (!line.trim()) continue;

        // Parse CSV row (handle quoted fields)
        var cols = line.split(',').map(function(c) { return c.trim().replace(/^"(.*)"$/, '$1').trim(); });

        // Column layout: MemberID(0), FullName(1), Email(2), Phone(3), Address(4), Type(5), JoinDate(6), StudentID(7), Grade(8), Section(9) 
        var name    = cols[1] ? cols[1].replace(/^\uFEFF/, '').trim() : '';
        var email   = cols[2] || '';
        var phone   = cols[3] || '';
        var address = cols[4] || '';
        var type    = cols[5] || 'Student';
        var sid     = cols[7] || '';
        var grade   = cols[8] || '';
        var section = cols[9] || '';

        if (!name || name.length < 2) continue;

        // Normalise type
        if (!['Student', 'Faculty', 'Staff'].includes(type)) type = 'Student';

        // Auto-generate email if missing
        if (!email || !email.includes('@')) {
          email = name.replace(/\s+/g, '.').toLowerCase() + '@student.school.com';
        }

        // Check if member already exists
        if (members.find(function(m) { return m.name.toLowerCase() === name.toLowerCase(); })) continue;

        // Send to API to create member in database
        try {
          var response = await fetch('api/members.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name:    name,
              email:   email,
              phone:   phone,
              type:    type,
              sid:     sid,
              grade:   grade,
              section: section,
              address: address
            })
          });

          var data = await response.json();
          if (data.success) {
            importedCount++;
          }
        } catch (err) {
          console.error('Error importing member:', err);
        }
      }

      await loadAllData();
      renderMembersTable();
      updateStats();
      showToast('Imported ' + importedCount + ' members from file!', 'success');
      event.target.value = ''; // reset input
    } catch(err) {
      console.error('Error importing file:', err);
      showToast('Error importing file. Please check the format.', 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

async function deleteMember(id) {
  if (!confirm('Remove this member?')) return;

  try {
    var response = await fetch('api/members.php', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to delete member', 'error');
      return;
    }

    await loadAllData();
    renderMembersTable();
    updateStats();
    showToast('Member removed', 'success');
  } catch (err) {
    console.error('Error deleting member:', err);
    showToast('Error deleting member', 'error');
  }
}

function openMemberHistory(memberId) {
  var m = members.find(function(m) { return (m.id == memberId) || (m.memberRef && m.memberRef == memberId); });
  if (!m) return;

  var memberIssues = issues.filter(function(i) { return i.memberId == m.id; });

  var displayId = m.memberRef || m.id;
  document.getElementById('mh-title').textContent    = m.name + ' — Issue History';
  document.getElementById('mh-meta').textContent     = displayId + ' \u2022 ' + m.type + ' \u2022 Total: ' + memberIssues.length + ' issue(s)';

  if (memberIssues.length === 0) {
    document.getElementById('mh-tbody').innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">No issue history found for this member.</td></tr>';
  } else {
    document.getElementById('mh-tbody').innerHTML = memberIssues.map(function(i) {
      return '<tr>' +
        '<td><span class="link">' + i.id + '</span></td>' +
        '<td>' + i.bookTitle + '</td>' +
        '<td style="font-size:12px">' + fmtDateTime(i.issueDate) + '</td>' +
        '<td style="font-size:12px">' + fmtDateTime(i.dueDate)   + '</td>' +
        '<td style="font-size:12px">' + (i.returnDate ? fmtDateTime(i.returnDate) : '<span style="color:var(--text-muted)">—</span>') + '</td>' +
        '<td>' + statusBadge(i.status, i.renewals) + '</td>' +
      '</tr>';
    }).join('');
  }

  openModal('member-history-modal');
}

function openEditMemberModal(id) {
  var m = members.find(function(m) { return m.id === id; });
  if (!m) return;
  document.getElementById('em-id').value      = m.id;
  document.getElementById('em-name').value    = m.name;
  document.getElementById('em-email').value   = m.email;
  document.getElementById('em-phone').value   = m.phone;
  document.getElementById('em-type').value    = m.type;
  document.getElementById('em-join').value    = fmtInput(m.joinDate);
  document.getElementById('em-sid').value     = m.sid;
  document.getElementById('em-grade').value   = m.grade;
  document.getElementById('em-section').value = m.section;
  toggleEditStudentFields();
  openModal('edit-member-modal');
}

function toggleEditStudentFields() {
  var t = document.getElementById('em-type').value;
  document.getElementById('edit-student-fields').style.display = (t === 'Student') ? 'block' : 'none';
}

async function saveEditMember() {
  var id    = document.getElementById('em-id').value;
  var name  = document.getElementById('em-name').value.trim();
  var email = document.getElementById('em-email').value.trim();
  if (!name || !email) { showToast('Please fill required fields', 'error'); return; }

  if (!isValidEmail(email)) { showToast('Please enter a valid email address', 'error'); return; }

  try {
    var response = await fetch('api/members.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:      id,
        name:    name,
        email:   email,
        phone:   document.getElementById('em-phone').value,
        type:    document.getElementById('em-type').value,
        sid:     document.getElementById('em-sid').value,
        grade:   document.getElementById('em-grade').value,
        section: document.getElementById('em-section').value
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to update member', 'error');
      return;
    }

    closeModal('edit-member-modal');
    await loadAllData();
    renderMembersTable();
    showToast('Member updated successfully!', 'success');
  } catch (err) {
    console.error('Error updating member:', err);
    showToast('Error updating member', 'error');
  }
}


//Super Admin: Librarian Management 

function openAddLibrarianModal() {
  document.getElementById('librarian-modal-title').textContent = 'Add New Librarian Account';
  document.getElementById('librarian-edit-id').value = '';
  document.getElementById('librarian-name').value = '';
  document.getElementById('librarian-email').value = '';
  document.getElementById('librarian-password').value = '';
  document.getElementById('librarian-password-confirm').value = '';
  openModal('add-librarian-modal');
}

function openEditLibrarianModal(email) {
  var lib = librarianAccounts.find(function(l) { return l.email === email; });
  if (!lib) return;
  
  document.getElementById('librarian-modal-title').textContent = 'Edit Librarian Account';
  document.getElementById('librarian-edit-id').value = email;
  document.getElementById('librarian-name').value = lib.name;
  document.getElementById('librarian-email').value = lib.email;
  document.getElementById('librarian-password').value = '';
  document.getElementById('librarian-password-confirm').value = '';
  document.getElementById('librarian-password').placeholder = 'Leave blank to keep current password';
  document.getElementById('librarian-password-confirm').placeholder = 'Leave blank to keep current password';
  openModal('add-librarian-modal');
}

async function saveLibrarian() {
  var editId = document.getElementById('librarian-edit-id').value;
  var name   = document.getElementById('librarian-name').value.trim();
  var email  = document.getElementById('librarian-email').value.trim();
  var pass   = document.getElementById('librarian-password').value;
  var pass2  = document.getElementById('librarian-password-confirm').value;

  if (!name || !email) { showToast('Please fill all required fields', 'error'); return; }
  if (!isValidEmail(email)) { showToast('Please enter a valid email address', 'error'); return; }

  if (!editId && !pass) { showToast('Please enter a password for new librarian', 'error'); return; }
  if (pass && pass !== pass2) { showToast('Passwords do not match', 'error'); return; }
  if (pass && pass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

  try {
    var url = 'api/librarians.php';
    var payload = {
      name: name,
      email: editId || email
    };

    var method = 'POST';
    if (editId) {
      method = 'PATCH';
      payload.email = editId;
      if (email !== editId) {
        payload.newEmail = email;
      }
      if (pass) {
        payload.password = pass;
      }
    } else {
      payload.password = pass;
    }

    var response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      throw new Error('Empty server response (status ' + response.status + ')');
    }

    var data = JSON.parse(rawText);
    if (!data.success) {
      showToast(data.message || 'Unable to save librarian account', 'error');
      return;
    }

    showToast(editId ? 'Librarian updated successfully!' : 'Librarian account created successfully!', 'success');
    await loadLibrarians();
    closeModal('add-librarian-modal');
  } catch (err) {
    console.error('Error saving librarian:', err);
    showToast(err.message || 'Unable to save librarian account', 'error');
  }
}

async function deleteLibrarian(email) {
  if (!confirm('Delete librarian account ' + email + '?')) return;

  try {
    var url = 'api/librarians.php';
    var response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });

    var rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      throw new Error('Empty server response (status ' + response.status + ')');
    }

    var data = JSON.parse(rawText);
    if (!data.success) {
      showToast(data.message || 'Unable to delete librarian account', 'error');
      return;
    }

    showToast('Librarian account deleted', 'success');
    await loadLibrarians();
  } catch (err) {
    console.error('Error deleting librarian:', err);
    showToast(err.message || 'Unable to delete librarian account', 'error');
  }
}

async function resetLibrarianPassword(email) {
  var tempPass = Math.random().toString(36).substring(2, 10).toUpperCase();

  try {
    var url = 'api/librarians.php';
    var response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: tempPass
      })
    });

    var rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      throw new Error('Empty server response (status ' + response.status + ')');
    }

    var data = JSON.parse(rawText);
    if (!data.success) {
      showToast(data.message || 'Unable to reset password', 'error');
      return;
    }

    showToast('Temporary password generated: ' + tempPass + '\nShare with librarian securely.', 'success');
    await loadLibrarians();
  } catch (err) {
    console.error('Error resetting librarian password:', err);
    showToast(err.message || 'Unable to reset password', 'error');
  }
}

function renderLibrarianList() {
  var list = document.getElementById('librarian-list');
  if (!list) return;
  
  if (librarianAccounts.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px;text-align:center;">No librarians yet. Click the button above to add one.</div>';
    return;
  }

  list.innerHTML = librarianAccounts.map(function(lib) {
    return '<div style="padding:12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">' +
      '<div>' +
        '<div style="font-weight:600;font-size:13px">' + lib.name + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted)">' + lib.email + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-sm btn-outline" onclick="openEditLibrarianModal(\'' + lib.email + '\')">Edit</button>' +
        '<button class="btn btn-sm btn-outline" onclick="resetLibrarianPassword(\'' + lib.email + '\')">Reset Pass</button>' +
        '<button class="btn btn-sm" style="background:var(--red);color:#fff;border:none" onclick="deleteLibrarian(\'' + lib.email + '\')">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function switchIssueTab(tab, btn) {
  currentIssueTab = tab;
  document.querySelectorAll('#issue-tabs .tab-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  renderIssuesTable();
}

function statusBadge(status, renewals) {
  if (status === 'Active')   return '<span class="badge badge-active">&#9679; Active</span>';
  if (status === 'Overdue')  return '<span class="badge badge-overdue">&#9679; Overdue</span>';
  if (status === 'Returned') return '<span class="badge badge-available">&#9679; Returned</span>';
  if (status === 'Lost')     return '<span class="badge badge-lost">&#9679; Lost</span>';
  if (status === 'Damaged')  return '<span class="badge badge-damaged">&#9679; Damaged</span>';
  if (status === 'Renewed')  return '<span class="badge badge-renewed">&#9679; Renewed &times;' + renewals + '</span>';
  return '';
}

function renderIssuesTable() {
  var q = (document.getElementById('issue-search') || { value: '' }).value.toLowerCase();

  var filtered = issues.filter(function(i) {
    if (currentIssueTab === 'active')   return i.status === 'Active'   || i.status === 'Renewed';
    if (currentIssueTab === 'overdue')  return i.status === 'Overdue';
    if (currentIssueTab === 'returned') return i.status === 'Returned' || i.status === 'Lost' || i.status === 'Damaged';
    return true;
  });

  if (q) {
    filtered = filtered.filter(function(i) {
      return i.bookTitle.toLowerCase().includes(q) || i.memberName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
    });
  }

  if (filtered.length === 0) {
    document.getElementById('issues-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No records found.</td></tr>';
    return;
  }

  document.getElementById('issues-tbody').innerHTML = filtered.map(function(i) {
    var diff     = daysDiff(TODAY, new Date(i.dueDate));
    var daysHtml = '';

    if (i.status === 'Returned' || i.status === 'Lost' || i.status === 'Damaged') {
      daysHtml = '<span class="text-muted">&mdash;</span>';
    } else if (diff < 0) {
      daysHtml = '<span class="days-left-over">' + Math.abs(diff) + 'd over</span>';
    } else if (diff === 0) {
      daysHtml = '<span class="days-left-warn">Due today</span>';
    } else if (diff <= 3) {
      daysHtml = '<span class="days-left-warn">' + diff + 'd left</span>';
    } else {
      daysHtml = '<span class="days-left-ok">' + diff + 'd left</span>';
    }

    var actions = (i.status !== 'Returned' && i.status !== 'Lost' && i.status !== 'Damaged')
      ? '<div class="action-btns">' +
          '<button class="btn btn-sm btn-outline" onclick="quickReturn(\'' + i.id + '\')">Return</button>' +
          (i.renewals < 2 ? '<button class="btn btn-sm btn-outline" onclick="renewIssue(\'' + i.id + '\')">&#8635; Renew</button>' : '') +
        '</div>'
      : '';

    return '<tr>' +
      '<td><span class="link">' + i.id + '</span></td>' +
      '<td><div class="td-title">' + i.bookTitle + '</div><div class="td-sub">' + i.author + '</div></td>' +
      '<td><div>' + i.memberName + '</div><div class="td-sub">' + '</div></td>' +
      '<td style="font-size:12px">' + fmtDateTime(i.issueDate) + '</td>' +
      '<td class="' + (i.status === 'Overdue' ? 'due-overdue' : '') + '" style="font-size:12px">' + fmtDateTime(i.dueDate) + '</td>' +
      '<td>' + daysHtml + '</td>' +
      '<td>' + statusBadge(i.status, i.renewals) + '</td>' +
      '<td>' + actions + '</td>' +
    '</tr>';
  }).join('');
}

async function issueBook() {
  var bookId   = parseInt(document.getElementById('i-book').value);
  var memberId = parseInt(document.getElementById('i-member').value, 10);
  var book     = books.find(function(b) { return b.id === bookId; });

  if (!book || book.available <= 0) { showToast('Book not available', 'error'); return; }

  var member    = members.find(function(m) { return m.id === memberId; });
  var issueDate = document.getElementById('i-date').value;
  var dueDate   = document.getElementById('i-due').value;

  try {
    var response = await fetch('api/issues.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        book_id:    bookId,
        member_id:  memberId,
        book_title: book.title,
        author:     book.author,
        member_name: member ? member.name : memberId,
        issue_date: issueDate,
        due_date:   dueDate
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to issue book', 'error');
      return;
    }

    // Also update book availability
    await fetch('api/books.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:        bookId,
        available: book.available - 1,
        status:    book.available - 1 === 0 ? 'Issued' : 'Available'
      })
    });

    // Update member active count
    if (member) {
      await fetch('api/members.php', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:           memberId,
          active:       member.active + 1,
          total_issued: member.totalIssued + 1
        })
      });
    }

    closeModal('issue-modal');
    await loadAllData();
    renderActiveIssuesList();
    updateStats();
    initDashCharts();
    if (document.getElementById('page-issues').classList.contains('active')) renderIssuesTable();
    if (document.getElementById('page-books').classList.contains('active'))  renderBooksTable();
    showToast('Book issued successfully!', 'success');
  } catch (err) {
    console.error('Error issuing book:', err);
    showToast('Error issuing book', 'error');
  }
}

async function confirmReturn() {
  var id        = document.getElementById('r-issue').value;
  var condition = document.getElementById('r-condition').value;
  var issue     = issues.find(function(i) { return i.id === id; });
  if (!issue) return;

  var wasOverdue = issue.status === 'Overdue';
  var returnTime = nowISO();
  var newStatus  = condition === 'Lost' ? 'Lost' : condition === 'Damaged' ? 'Damaged' : 'Returned';

  try {
    // Update issue with return info 
    var response = await fetch('api/issues.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:          id,
        status:      newStatus,
        return_date: returnTime,
        condition:   condition
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to process return', 'error');
      return;
    }

    // Update book availability 
    var book = books.find(function(b) { return b.id === issue.bookId; });
    if (book) {
      var updateData = { id: book.id };
      if (condition === 'Lost') {
        updateData.is_lost = 1;
        updateData.status = 'Lost';
      } else if (condition === 'Damaged') {
        updateData.is_damaged = 1;
        updateData.available = book.available + 1;
        updateData.status = book.available + 1 > 0 ? 'Available' : 'Issued';
      } else {
        updateData.available = book.available + 1;
        updateData.status = 'Available';
      }
      await fetch('api/books.php', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
    }

    // Update member active and overdue counts 
    var member = members.find(function(m) { return m.id === issue.memberId; });
    if (member) {
      var newActive  = Math.max(0, member.active - 1);
      var newOverdue = wasOverdue ? Math.max(0, member.overdue - 1) : member.overdue;
      await fetch('api/members.php', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:      issue.memberId,
          active:  newActive,
          overdue: newOverdue
        })
      });
    }

    closeModal('return-modal');
    await loadAllData();
    renderIssuesTable();
    renderActiveIssuesList();
    updateStats();
    initDashCharts();
    showToast('Book returned successfully!', 'success');
  } catch (err) {
    console.error('Error processing return:', err);
    showToast('Error processing return', 'error');
  }
}

async function renewIssue(id) {
  var issue = issues.find(function(i) { return i.id === id; });
  if (!issue || issue.renewals >= 2) return;

  var newRenewals = issue.renewals + 1;
  var due         = new Date(issue.dueDate);
  due.setDate(due.getDate() + 14);
  var newDueDate  = due.toISOString().slice(0, 10);

  try {
    var response = await fetch('api/issues.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:        id,
        renewals:  newRenewals,
        due_date:  newDueDate,
        status:    'Active'
      })
    });

    var data = await response.json();
    if (!data.success) {
      showToast(data.message || 'Failed to renew book', 'error');
      return;
    }

    await loadAllData();
    renderIssuesTable();
    updateStats();
    showToast('Book renewed for 14 more days!', 'success');
  } catch (err) {
    console.error('Error renewing book:', err);
    showToast('Error renewing book', 'error');
  }
}

async function quickReturn(id) {
  var issue = issues.find(function(i) { return i.id === id; });
  if (!issue) return;

  var sel = document.getElementById('r-issue');
  sel.innerHTML = issues
    .filter(function(i) { return i.status !== 'Returned' && i.status !== 'Lost' && i.status !== 'Damaged'; })
    .map(function(i) {
      return '<option value="' + i.id + '"' + (i.id === id ? ' selected' : '') + '>' + i.id + ' \u2014 ' + i.bookTitle + ' (' + i.memberName + ')</option>';
    }).join('');
  document.getElementById('r-condition').value = 'Good';
  openModal('return-modal');
}

function returnBook() { confirmReturn(); }


// Reports 

function switchReportTab(tab, btn) {
  currentReportTab = tab;
  document.querySelectorAll('.report-panel .tab-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  renderReportTable();
}

function renderReportTable() {
  var q        = (document.getElementById('rpt-search')  || { value: '' }).value.toLowerCase();
  var fromVal  = (document.getElementById('rpt-from')    || { value: '' }).value;
  var toVal    = (document.getElementById('rpt-to')      || { value: '' }).value;
  var memberF  = (document.getElementById('rpt-member-filter') || { value: '' }).value;
  var filtered = issues.slice();

  if (currentReportTab === 'issued')  filtered = filtered.filter(function(i) { return i.status === 'Active' || i.status === 'Renewed' || i.status === 'Overdue'; });
  if (currentReportTab === 'overdue') filtered = filtered.filter(function(i) { return i.status === 'Overdue'; });
  if (currentReportTab === 'damaged') filtered = filtered.filter(function(i) { return i.status === 'Lost' || i.status === 'Damaged'; });

  if (q) {
    filtered = filtered.filter(function(i) {
      return i.bookTitle.toLowerCase().includes(q) || i.memberName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
    });
  }

  if (memberF) { filtered = filtered.filter(function(i) { return i.memberId === parseInt(memberF, 10); }); }

  if (fromVal) {
    var fromDate = new Date(fromVal);
    filtered = filtered.filter(function(i) { return new Date(i.issueDate) >= fromDate; });
  }
  if (toVal) {
    var toDate = new Date(toVal);
    toDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter(function(i) { return new Date(i.issueDate) <= toDate; });
  }

  if (filtered.length === 0) {
    document.getElementById('report-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No records found.</td></tr>';
    return;
  }

  document.getElementById('report-tbody').innerHTML = filtered.map(function(i) {
    return '<tr>' +
      '<td><span class="link">' + i.id + '</span></td>' +
      '<td>' + i.bookTitle  + '</td>' +
      '<td>' + i.memberName + '</td>' +
      '<td style="font-size:12px">' + fmtDateTime(i.issueDate) + '</td>' +
      '<td class="' + (i.status === 'Overdue' ? 'due-overdue' : '') + '" style="font-size:12px">' + fmtDateTime(i.dueDate) + '</td>' +
      '<td>' + i.renewals + '</td>' +
      '<td>' + statusBadge(i.status, i.renewals) + '</td>' +
    '</tr>';
  }).join('');
}

function populateReportMemberFilter() {
  var sel = document.getElementById('rpt-member-filter');
  if (!sel) return;
  sel.innerHTML = '<option value="">All Members</option>' +
    members.map(function(m) { return '<option value="' + m.id + '">' + m.name + '</option>'; }).join('');
}

function initReportCharts() {
  var catCount = {};
  issues.forEach(function(i) {
    var b = books.find(function(b) { return b.id === i.bookId; });
    if (b) catCount[b.category] = (catCount[b.category] || 0) + 1;
  });

  var rptLabels = Object.keys(catCount);
  var rptValues = Object.values(catCount);

  if (rptCatChart) rptCatChart.destroy();
  rptCatChart = new Chart(document.getElementById('rpt-cat-chart'), {
    type: 'bar',
    data: {
      labels: rptLabels.length > 0 ? rptLabels : ['No data'],
      datasets: [{
        data: rptValues.length > 0 ? rptValues : [0],
        backgroundColor: rptLabels.map(function() { return '#2ec4a0'; }),
        borderWidth: 0, borderRadius: 5
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { color: '#9bb5ad' } },
        x: { grid: { display: false }, ticks: { color: '#9bb5ad' } }
      },
      responsive: true, maintainAspectRatio: false
    }
  });

  var monthData = [0, 0, 0, 0, 0, 0];
  var monthMap  = { 9:0, 10:1, 11:2, 0:3, 1:4, 2:5 };
  issues.forEach(function(i) {
    var m = new Date(i.issueDate).getMonth();
    if (monthMap[m] !== undefined) monthData[monthMap[m]]++;
  });

  if (rptMonthlyChart) rptMonthlyChart.destroy();
  rptMonthlyChart = new Chart(document.getElementById('rpt-monthly-chart'), {
    type: 'line',
    data: {
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      datasets: [{
        data: monthData,
        borderColor: '#2ec4a0', backgroundColor: 'rgba(46,196,160,0.08)',
        tension: .4, pointBackgroundColor: '#2ec4a0', pointRadius: 5, fill: true
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
        x: { grid: { display: false } }
      },
      responsive: true, maintainAspectRatio: false
    }
  });
}

function exportCSV() {
  if (issues.length === 0) { showToast('No data to export', 'error'); return; }
  var rows = [['Issue ID', 'Book Title', 'Member', 'Issue Date', 'Due Date', 'Renewals', 'Status']];
  issues.forEach(function(i) {
    rows.push([i.id, '"' + i.bookTitle + '"', '"' + i.memberName + '"', i.issueDate, i.dueDate, i.renewals, i.status]);
  });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var a   = document.createElement('a');
  a.href  = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'library-report.csv';
  a.click();
  showToast('CSV exported!', 'success');
}


// Modals 

function openAddBookModal() { openModal('add-book-modal'); }

function openRegisterModal() {
  document.getElementById('m-join').value = fmtInput(TODAY);
  toggleStudentFields();
  openModal('register-member-modal');
}

function toggleStudentFields() {
  var t = document.getElementById('m-type').value;
  document.getElementById('student-fields').style.display = (t === 'Student') ? 'block' : 'none';
}

function openIssueModal(bookId, memberId) {
  bookId   = bookId   ? parseInt(bookId, 10)   : null;
  memberId = memberId ? parseInt(memberId, 10) : null;
  var availableBooks = books.filter(function(b) { return b.available > 0; });
  if (availableBooks.length === 0) { showToast('No books available', 'error'); return; }
  if (members.length === 0)        { showToast('No members registered', 'error'); return; }

  var sel = document.getElementById('i-book');
  sel.innerHTML = availableBooks.map(function(b) {
    return '<option value="' + b.id + '"' + (b.id === bookId ? ' selected' : '') + '>' + b.title + ' (' + b.available + ' avail)</option>';
  }).join('');

  var msel = document.getElementById('i-member');
  msel.innerHTML = members.map(function(m) {
    return '<option value="' + m.id + '"' + (m.id === memberId ? ' selected' : '') + '>' + m.name + '</option>';
  }).join('');

  var now = new Date();
  document.getElementById('i-date').value = now.toISOString().slice(0, 16);
  var due = new Date(now);
  // Use category-based loan duration if available 
  var selectedBookId = parseInt(sel.value);
  var selectedBook = books.find(function(b) { return b.id === selectedBookId; });
  var loanDays = selectedBook && loanDurationByCategory[selectedBook.category]
    ? loanDurationByCategory[selectedBook.category]
    : 14;
  due.setDate(due.getDate() + loanDays);
  document.getElementById('i-due').value = due.toISOString().slice(0, 16);

  openModal('issue-modal');
}

function openReturnModal() {
  var active = issues.filter(function(i) { return i.status !== 'Returned' && i.status !== 'Lost' && i.status !== 'Damaged'; });
  if (active.length === 0) { showToast('No active issues', 'error'); return; }
  var sel = document.getElementById('r-issue');
  sel.innerHTML = active.map(function(i) {
    return '<option value="' + i.id + '">' + i.id + ' \u2014 ' + i.bookTitle + ' (' + i.memberName + ')</option>';
  }).join('');
  openModal('return-modal');
}


// Toast
function showToast(msg, type) {
  type = type || 'success';
  var t = document.createElement('div');
  t.className = 'toast-item ' + type;
  t.textContent = msg;
  document.getElementById('toast').appendChild(t);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
}


// Init 

document.addEventListener('DOMContentLoaded', function() {
  loadLibrarians().catch(function() {
    librarianAccounts = [];
    renderLibrarianList();
  });

  restoreSession();
  document.querySelectorAll('.modal-overlay').forEach(function(m) {
    m.addEventListener('click', function(e) { if (e.target === m) m.classList.remove('open'); });
  });

  var lu = document.getElementById('login-user');
  var lp = document.getElementById('login-pass');
  if (lu) lu.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  if (lp) lp.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  
  // Allow student search enter key 
  var ssn = document.getElementById('student-search-name');
  if (ssn) ssn.addEventListener('keydown', function(e) { if (e.key === 'Enter') searchStudentBorrowingInfo(); });
});