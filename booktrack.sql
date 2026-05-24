CREATE DATABASE IF NOT EXISTS `booktrack` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `booktrack`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('superadmin','librarian','student') NOT NULL DEFAULT 'student',
  `name` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `librarians` (
  `email` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `isbn` VARCHAR(50) UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `shelf` VARCHAR(50) DEFAULT NULL,
  `copies` INT DEFAULT 1,
  `available` INT DEFAULT 1,
  `status` VARCHAR(50) DEFAULT 'Available',
  `is_lost` TINYINT(1) NOT NULL DEFAULT 0,
  `is_damaged` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_ref` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `type` ENUM('Student','Faculty') DEFAULT 'Student',
  `join_date` DATE DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `sid` VARCHAR(50) DEFAULT NULL,
  `grade` VARCHAR(50) DEFAULT NULL,
  `section` VARCHAR(50) DEFAULT NULL,
  `active` INT DEFAULT 0,
  `overdue` INT DEFAULT 0,
  `total_issued` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `issues` (
  `id` VARCHAR(50) PRIMARY KEY,
  `book_id` INT DEFAULT NULL,
  `book_title` VARCHAR(255) DEFAULT NULL,
  `author` VARCHAR(255) DEFAULT NULL,
  `member_id` INT DEFAULT NULL,
  `member_name` VARCHAR(255) DEFAULT NULL,
  `issue_date` DATETIME DEFAULT NULL,
  `due_date` DATETIME DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Active',
  `renewals` INT DEFAULT 0,
  `return_date` DATETIME DEFAULT NULL,
  `condition` VARCHAR(50) DEFAULT 'Good',
  INDEX (`book_id`),
  INDEX (`member_id`),
  FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `loan_durations` (
  `category` VARCHAR(100) PRIMARY KEY,
  `duration_days` INT DEFAULT 14
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `expiry` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (`email`),
  INDEX (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;