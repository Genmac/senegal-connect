-- docs/schema.sql

-- Nettoyage des anciennes tables si elles existent
DROP TABLE IF EXISTS appels CASCADE;
DROP TABLE IF EXISTS messages_statut CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS factures CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS forfaits CASCADE;
DROP TABLE IF EXISTS utilisateurs CASCADE;

-- 1. Table Utilisateurs (Authentification et Rôles)
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'agent', 'admin')),
    cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role);

-- 2. Table Forfaits (Offres commerciales)
CREATE TABLE forfaits (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    quota_data_go INT NOT NULL CHECK (quota_data_go >= 0),
    quota_voix_min INT NOT NULL CHECK (quota_voix_min >= 0),
    prix_mensuel_fcfa NUMERIC(10, 2) NOT NULL CHECK (prix_mensuel_fcfa > 0),
    actif BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_forfaits_actif ON forfaits(actif);

-- 3. Table Clients (Abonnés)
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT REFERENCES utilisateurs(id) ON DELETE CASCADE,
    msisdn VARCHAR(15) UNIQUE NOT NULL CHECK (msisdn ~ '^\+221[0-9]{9}$'),
    forfait_id INT REFERENCES forfaits(id) ON DELETE SET NULL,
    statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'resilie')),
    date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_msisdn ON clients(msisdn);
CREATE INDEX idx_clients_forfait_id ON clients(forfait_id);
CREATE INDEX idx_clients_statut ON clients(statut);

-- 4. Table Factures
CREATE TABLE factures (
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    reference VARCHAR(50) UNIQUE NOT NULL,
    periode VARCHAR(7) NOT NULL, -- Format YYYY-MM
    montant_fcfa NUMERIC(10, 2) NOT NULL CHECK (montant_fcfa >= 0),
    statut VARCHAR(20) DEFAULT 'impayee' CHECK (statut IN ('payee', 'impayee', 'en_retard')),
    date_emission TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_echeance TIMESTAMP NOT NULL
);

CREATE INDEX idx_factures_client_id ON factures(client_id);
CREATE INDEX idx_factures_statut ON factures(statut);
CREATE INDEX idx_factures_periode ON factures(periode);

-- 5. Table Tickets (Support client)
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    sujet VARCHAR(255) NOT NULL,
    statut VARCHAR(20) DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_cours', 'ferme')),
    ouvert_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ferme_le TIMESTAMP
);

CREATE INDEX idx_tickets_client_id ON tickets(client_id);
CREATE INDEX idx_tickets_agent_id ON tickets(agent_id);
CREATE INDEX idx_tickets_statut ON tickets(statut);

-- 6. Table Messages (Chat support)
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    expediteur_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type VARCHAR(20) DEFAULT 'texte' CHECK (type IN ('texte', 'fichier', 'image', 'audio')),
    contenu TEXT,
    fichier_url VARCHAR(255),
    fichier_nom VARCHAR(255),
    fichier_taille INT,
    envoye_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_ticket_envoye ON messages(ticket_id, envoye_le DESC);

-- 7. Table Messages Statut (Accusés de réception)
CREATE TABLE messages_statut (
    message_id INT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    utilisateur_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    statut VARCHAR(20) DEFAULT 'envoye' CHECK (statut IN ('envoye', 'lu')),
    lu_le TIMESTAMP,
    PRIMARY KEY (message_id, utilisateur_id)
);

CREATE INDEX idx_messages_statut_message ON messages_statut(message_id);

-- 8. Table Appels (Support audio/vidéo WebRTC)
CREATE TABLE appels (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    initiateur_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    destinataire_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type VARCHAR(10) CHECK (type IN ('audio', 'video')),
    statut VARCHAR(20) DEFAULT 'initie' CHECK (statut IN ('initie', 'accepte', 'refuse', 'termine')),
    duree_secondes INT DEFAULT 0,
    debut_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fin_le TIMESTAMP
);

CREATE INDEX idx_appels_ticket_id ON appels(ticket_id);
CREATE INDEX idx_appels_statut ON appels(statut);

-- --- DONNÉES DE TEST INITIALES ---

-- Insertion de 4 Forfaits
INSERT INTO forfaits (nom, quota_data_go, quota_voix_min, prix_mensuel_fcfa) VALUES
('Pass Jeune', 5, 60, 2500.00),
('Kouloucom', 15, 300, 7500.00),
('Teranga Premium', 50, 1000, 19900.00),
('Illimité Business', 200, 9999, 45000.00);
