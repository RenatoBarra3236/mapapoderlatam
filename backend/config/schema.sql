-- Create database
CREATE DATABASE IF NOT EXISTS mapapoderlatam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mapapoderlatam;

-- Nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('person', 'company', 'contract')),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(10) DEFAULT 'CL',
  metadata JSON DEFAULT '{}',
  risk_score INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_nodes_name (name),
  INDEX idx_nodes_type (type),
  INDEX idx_nodes_country (country),
  FULLTEXT INDEX ft_nodes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Edges table
CREATE TABLE IF NOT EXISTS edges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  target_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  weight DECIMAL(10, 2) DEFAULT 1.0,
  source_url VARCHAR(500),
  valid_from DATE,
  valid_to DATE,
  metadata JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_edge (source_id, target_id, type),
  INDEX idx_edges_source (source_id),
  INDEX idx_edges_target (target_id),
  INDEX idx_edges_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Node degree view (for stats)
CREATE OR REPLACE VIEW node_degree AS
SELECT
  n.id,
  n.name,
  n.type,
  n.country,
  COUNT(DISTINCT e1.id) AS out_degree,
  COUNT(DISTINCT e2.id) AS in_degree,
  COUNT(DISTINCT e1.id) + COUNT(DISTINCT e2.id) AS total_degree
FROM nodes n
LEFT JOIN edges e1 ON e1.source_id = n.id
LEFT JOIN edges e2 ON e2.target_id = n.id
GROUP BY n.id, n.name, n.type, n.country;
