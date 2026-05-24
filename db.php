<?php
class db {
    protected $connection;

    function setconnection() {
        try {
            $this->connection = new PDO(
                "mysql:host=localhost;dbname=booktrack;charset=utf8mb4",
                "root",
                ""
            );
            $this->connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            return $this->connection;
        } catch (PDOException $e) {
            echo "Database connection error: " . $e->getMessage();
            exit;
        }
    }
}

