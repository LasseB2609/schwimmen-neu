-- phpMyAdmin SQL Dump
-- version 5.0.2
-- https://www.phpmyadmin.net/
--
-- Host: meinecooledb
-- Generation Time: Apr 09, 2020 at 12:19 PM
-- Server version: 10.4.12-MariaDB-1:10.4.12+maria~bionic
-- PHP Version: 7.4.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================
-- TABLE: Player (Spieler-Accounts)
-- ============================================
CREATE TABLE IF NOT EXISTS Player (
    player_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: Card (Statische Kartendefinitionen)
-- ============================================
CREATE TABLE IF NOT EXISTS Card (
    card_id INT AUTO_INCREMENT PRIMARY KEY,
    suit VARCHAR(20) NOT NULL,      -- 'Herz', 'Karo', 'Kreuz', 'Pik'
    rank VARCHAR(5) NOT NULL,       -- '6', '7', '8', '9', '10', 'B', 'D', 'K', 'A'
    value INT NOT NULL              -- Kartenwert: 7-11
);

-- ============================================
-- TABLE: Game (Ein einzelnes Spiel)
-- ============================================
CREATE TABLE IF NOT EXISTS Game (
    game_id INT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'waiting',  -- 'waiting', 'playing', 'finished'
    round_number INT DEFAULT 0,
    current_player_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: Game_Player (Spieler im Spiel)
-- ============================================
CREATE TABLE IF NOT EXISTS Game_Player (
    game_player_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    player_id INT NOT NULL,
    socket_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    lives INT DEFAULT 3,
    score INT DEFAULT 0
);

-- ============================================
-- TABLE: Game_Card (Kartenpositionen im Spiel)
-- ============================================
CREATE TABLE IF NOT EXISTS Game_Card (
    game_card_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    card_id INT NOT NULL,
    location VARCHAR(50) NOT NULL,  -- 'deck', 'hand', 'table', 'discard'
    owner_player_id INT,            -- NULL wenn im Deck/Discard
    position INT DEFAULT 0          -- Position der Karte
);

-- ============================================
-- INSERT: Alle 32 Karten (6-A, alle Farben)
-- ============================================
INSERT INTO Card (suit, rank, value) VALUES
-- Herz
('Herz', '7', 7),
('Herz', '8', 8),
('Herz', '9', 9),
('Herz', '10', 10),
('Herz', 'B', 10),
('Herz', 'D', 10),
('Herz', 'K', 10),
('Herz', 'A', 11),
-- Karo
('Karo', '7', 7),
('Karo', '8', 8),
('Karo', '9', 9),
('Karo', '10', 10),
('Karo', 'B', 10),
('Karo', 'D', 10),
('Karo', 'K', 10),
('Karo', 'A', 11),
-- Kreuz
('Kreuz', '7', 7),
('Kreuz', '8', 8),
('Kreuz', '9', 9),
('Kreuz', '10', 10),
('Kreuz', 'B', 10),
('Kreuz', 'D', 10),
('Kreuz', 'K', 10),
('Kreuz', 'A', 11),
-- Pik
('Pik', '7', 7),
('Pik', '8', 8),
('Pik', '9', 9),
('Pik', '10', 10),
('Pik', 'B', 10),
('Pik', 'D', 10),
('Pik', 'K', 10),
('Pik', 'A', 11);

COMMIT;