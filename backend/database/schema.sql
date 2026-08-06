CREATE TABLE IF NOT EXISTS hospitals (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  city       VARCHAR(100),
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_orgs (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospital_insurance (
  id               INT       AUTO_INCREMENT PRIMARY KEY,
  hospital_id      INT       NOT NULL,
  insurance_org_id INT       NOT NULL,
  active           TINYINT   DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_link (hospital_id, insurance_org_id),
  FOREIGN KEY (hospital_id)      REFERENCES hospitals(id),
  FOREIGN KEY (insurance_org_id) REFERENCES insurance_orgs(id)
);

CREATE TABLE IF NOT EXISTS users (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(150) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  role             ENUM('super_admin','admin','doctor','insurance') DEFAULT NULL,
  status           ENUM('pending','active','rejected') DEFAULT 'pending',
  hospital_id      INT          DEFAULT NULL,
  insurance_org_id INT          DEFAULT NULL,
  org_name         VARCHAR(150),
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id)      REFERENCES hospitals(id),
  FOREIGN KEY (insurance_org_id) REFERENCES insurance_orgs(id)
);

CREATE TABLE IF NOT EXISTS patients (
  id                  INT          AUTO_INCREMENT PRIMARY KEY,
  patient_id          VARCHAR(20)  NOT NULL,
  hospital_id         INT          NOT NULL,
  name                VARCHAR(100),
  age                 INT,
  gender              VARCHAR(10),
  heart_rate          INT,
  blood_pressure_sys  INT,
  blood_pressure_dia  INT,
  visit_count         INT          DEFAULT 0,
  admission_count     INT          DEFAULT 0,
  price               DECIMAL(10,2) NULL,
  upload_run_id       VARCHAR(50),
  uploaded_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_patient_hospital (patient_id, hospital_id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  patient_id   VARCHAR(20)  NOT NULL,
  hospital_id  INT          NOT NULL,
  context      ENUM('doctor','admin','insurance') NOT NULL,
  risk_score   INT          DEFAULT 0,
  risk_level   ENUM('Low','Medium','High','Critical') NOT NULL,
  explanation  TEXT,
  evaluated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

CREATE TABLE IF NOT EXISTS matched_rules (
  id            INT         AUTO_INCREMENT PRIMARY KEY,
  evaluation_id INT         NOT NULL,
  rule_id       VARCHAR(50),
  rule_name     VARCHAR(100),
  score_added   INT         DEFAULT 0,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_patients_hospital  ON patients(hospital_id);
CREATE INDEX idx_eval_ctx           ON evaluations(patient_id, hospital_id, context);
CREATE INDEX idx_eval_risk          ON evaluations(risk_level);
CREATE INDEX idx_patients_run       ON patients(upload_run_id, hospital_id);