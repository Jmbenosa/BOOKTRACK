<?php
$mysqli = new mysqli('127.0.0.1', 'root', '', 'booktrack');
if ($mysqli->connect_error) {
    echo 'Connect error: ' . $mysqli->connect_error;
} else {
    echo 'Connected to MySQL successfully';
}
?>