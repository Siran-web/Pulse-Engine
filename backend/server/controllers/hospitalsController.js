/**
 * controllers/hospitalsController.js
 *
 * FLOW — getSystemStats: raw SQL COUNT queries → one object with all counts
 * FLOW — listHospitals: findAll with admin user include
 * FLOW — createHospital: findOrCreate → 409 if duplicate
 * FLOW — getHospital: findByPk + patient/user counts
 * FLOW — listInsuranceOrgs: findAll with linked hospitals
 * FLOW — createInsuranceOrg: findOrCreate → 409 if duplicate
 * FLOW — linkInsuranceOrg: findOrCreate HospitalInsurance row; reactivate if existed
 * FLOW — toggleInsuranceLink: flip active 0↔1
 */

const sequelize = require("../db/mysql");
const Hospital = require("../models/Hospital");
const InsuranceOrg = require("../models/InsuranceOrg");
const HospitalInsurance = require("../models/HospitalInsurance");
const User = require("../models/User");

const getSystemStats = async (req, res) => {
  try {
    const [[h], [p], [u], [pend], [ins]] = await Promise.all([
      sequelize.query("SELECT COUNT(*) AS count FROM hospitals"),
      sequelize.query("SELECT COUNT(*) AS count FROM patients"),
      sequelize.query(
        "SELECT COUNT(*) AS count FROM users WHERE status='active'",
      ),
      sequelize.query(
        "SELECT COUNT(*) AS count FROM users WHERE status='pending'",
      ),
      sequelize.query("SELECT COUNT(*) AS count FROM insurance_orgs"),
    ]);
    return res.json({
      success: true,
      stats: {
        hospitals: h[0].count,
        total_patients: p[0].count,
        active_users: u[0].count,
        pending_approvals: pend[0].count,
        insurance_orgs: ins[0].count,
      },
    });
  } catch (err) {
    console.error("[hospitalsController.getSystemStats]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch stats" });
  }
};

const listHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.findAll({
      include: [
        {
          model: User,
          as: "users",
          where: { role: "admin", status: "active" },
          required: false,
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });
    return res.json({ success: true, hospitals });
  } catch (err) {
    console.error("[hospitalsController.listHospitals]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch hospitals" });
  }
};

const createHospital = async (req, res) => {
  try {
    const { name, city } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Hospital name is required" });
    const existing = await Hospital.findOne({ where: { name: name.trim() } });
    if (existing)
      return res
        .status(409)
        .json({ success: false, message: `Hospital "${name}" already exists` });
    const hospital = await Hospital.create({
      name: name.trim(),
      city: city?.trim() || "",
    });
    return res
      .status(201)
      .json({ success: true, message: "Hospital created", hospital });
  } catch (err) {
    console.error("[hospitalsController.createHospital]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create hospital" });
  }
};

const getHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital)
      return res
        .status(404)
        .json({ success: false, message: "Hospital not found" });
    const [[p], [u]] = await Promise.all([
      sequelize.query(
        "SELECT COUNT(*) AS count FROM patients WHERE hospital_id=:id",
        { replacements: { id: hospital.id } },
      ),
      sequelize.query(
        "SELECT COUNT(*) AS count FROM users WHERE hospital_id=:id AND status='active'",
        { replacements: { id: hospital.id } },
      ),
    ]);
    return res.json({
      success: true,
      hospital: {
        ...hospital.toJSON(),
        patient_count: p[0].count,
        user_count: u[0].count,
      },
    });
  } catch (err) {
    console.error("[hospitalsController.getHospital]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch hospital" });
  }
};

const listInsuranceOrgs = async (req, res) => {
  try {
    const orgs = await InsuranceOrg.findAll({
      include: [
        {
          model: Hospital,
          as: "hospitals",
          through: { attributes: ["id", "active"] },
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });
    return res.json({ success: true, orgs });
  } catch (err) {
    console.error("[hospitalsController.listInsuranceOrgs]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch insurance orgs" });
  }
};

const createInsuranceOrg = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Organisation name is required" });
    const [org, created] = await InsuranceOrg.findOrCreate({
      where: { name: name.trim() },
      defaults: { name: name.trim() },
    });
    if (!created)
      return res.status(409).json({
        success: false,
        message: `Insurance org "${name}" already exists`,
      });
    return res
      .status(201)
      .json({ success: true, message: "Insurance org created", org });
  } catch (err) {
    console.error("[hospitalsController.createInsuranceOrg]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create insurance org" });
  }
};

const linkInsuranceOrg = async (req, res) => {
  try {
    const { hospital_id, insurance_org_id } = req.body;
    if (!hospital_id || !insurance_org_id) {
      return res.status(400).json({
        success: false,
        message: "hospital_id and insurance_org_id are required",
      });
    }
    const hospital = await Hospital.findByPk(hospital_id);
    if (!hospital)
      return res
        .status(404)
        .json({ success: false, message: "Hospital not found" });
    const org = await InsuranceOrg.findByPk(insurance_org_id);
    if (!org)
      return res
        .status(404)
        .json({ success: false, message: "Insurance org not found" });

    const [link, created] = await HospitalInsurance.findOrCreate({
      where: { hospital_id, insurance_org_id },
      defaults: { hospital_id, insurance_org_id, active: 1 },
    });
    if (!created && !link.active) await link.update({ active: 1 });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Link created" : "Link reactivated",
      link,
    });
  } catch (err) {
    console.error("[hospitalsController.linkInsuranceOrg]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create link" });
  }
};

const toggleInsuranceLink = async (req, res) => {
  try {
    const link = await HospitalInsurance.findByPk(req.params.id);
    if (!link)
      return res
        .status(404)
        .json({ success: false, message: "Link not found" });
    await link.update({ active: link.active ? 0 : 1 });
    return res.json({
      success: true,
      message: `Link ${link.active ? "activated" : "deactivated"}`,
      link,
    });
  } catch (err) {
    console.error("[hospitalsController.toggleInsuranceLink]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update link" });
  }
};

const deleteInsuranceOrg = async (req, res) => {
  try {
    const org = await InsuranceOrg.findByPk(req.params.id);
    if (!org) {
      return res
        .status(404)
        .json({ success: false, message: "Insurance organization not found" });
    }

    // This will delete the organization.
    // Links in HospitalInsurance will be cleaned up based on DB constraints or manually if needed.
    await org.destroy();

    return res.json({
      success: true,
      message: `Insurance organization "${org.name}" deleted successfully.`,
    });
  } catch (err) {
    console.error("[hospitalsController.deleteInsuranceOrg]", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete insurance organization",
      });
  }
};

const deleteHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) {
      return res
        .status(404)
        .json({ success: false, message: "Hospital not found" });
    }

    // Cascade: Standard medical practice is to decommissioning the record.
    // Here we perform a physical delete.
    await hospital.destroy();

    return res.json({
      success: true,
      message: `Hospital "${hospital.name}" decommissioned successfully.`,
    });
  } catch (err) {
    console.error("[hospitalsController.deleteHospital]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to decommission hospital" });
  }
};

const updateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city } = req.body;

    const hospital = await Hospital.findByPk(id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    // Update fields
    if (name) hospital.name = name.trim();
    if (city !== undefined) hospital.city = city.trim();

    await hospital.save();

    return res.json({
      success: true,
      message: "Hospital updated successfully",
      hospital,
    });
  } catch (err) {
    console.error("[hospitalsController.updateHospital]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update hospital",
    });
  }
};

module.exports = {
  getSystemStats,
  listHospitals,
  createHospital,
  getHospital,
  deleteHospital,
  listInsuranceOrgs,
  createInsuranceOrg,
  deleteInsuranceOrg,
  linkInsuranceOrg,
  toggleInsuranceLink,
  updateHospital,
};
