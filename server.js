/*const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Import models
const Patient = require('./models/Patient');
const Visit = require('./models/Visit');
const Diagnosis = require('./models/Diagnosis');

const app = express();
app.use(bodyParser.json());

// --- MongoDB connection ---
mongoose.connect('mongodb://localhost:27017/legacy_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected to legacy_db'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Helper functions to map MongoDB documents to FHIR resources ---

// Patient → FHIR Patient
function mapPatientToFHIR(patient) {
  return {
    resourceType: "Patient",
    id: patient._id,
    identifier: [
      {
        use: "usual",
        value: patient._id
      }
    ],
    name: [
      {
        use: "official",
        given: [patient.first_name],
        family: patient.last_name
      }
    ],
    birthDate: patient.date_of_birth ? patient.date_of_birth.toISOString().split('T')[0] : undefined,
    gender: patient.gender,
    telecom: patient.contact_number ? [
      {
        system: "phone",
        value: patient.contact_number,
        use: "mobile"
      }
    ] : undefined,
    meta: {
      lastUpdated: patient.updatedAt ? patient.updatedAt.toISOString() : new Date().toISOString()
    }
  };
}

// Visit → FHIR Encounter
function mapVisitToFHIR(visit) {
  return {
    resourceType: "Encounter",
    id: visit._id,
    identifier: [
      {
        use: "usual",
        value: visit._id
      }
    ],
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory"
    },
    subject: {
      reference: `Patient/${visit.patient_id}`,
      display: `Patient ${visit.patient_id}`
    },
    period: {
      start: visit.visit_date ? visit.visit_date.toISOString() : undefined
    },
    reasonCode: visit.reason ? [
      {
        text: visit.reason
      }
    ] : undefined,
    extension: visit.vitals ? [
      {
        url: "http://hl7.org/fhir/StructureDefinition/encounter-vitals",
        valueString: `HR: ${visit.vitals.heart_rate || 'N/A'}, BP: ${visit.vitals.blood_pressure || 'N/A'}`
      }
    ] : undefined,
    meta: {
      lastUpdated: visit.updatedAt ? visit.updatedAt.toISOString() : new Date().toISOString()
    }
  };
}

// Diagnosis → FHIR Condition
function mapDiagnosisToFHIR(diagnosis) {
  return {
    resourceType: "Condition",
    id: diagnosis._id,
    identifier: [
      {
        use: "usual",
        value: diagnosis._id
      }
    ],
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "Active"
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed"
        }
      ]
    },
    subject: {
      reference: `Patient/${diagnosis.patient_id}`,
      display: `Patient ${diagnosis.patient_id}`
    },
    encounter: {
      reference: `Encounter/${diagnosis.visit_id}`,
      display: `Encounter ${diagnosis.visit_id}`
    },
    code: {
      coding: diagnosis.icd10_code ? [
        {
          system: "http://hl7.org/fhir/sid/icd-10",
          code: diagnosis.icd10_code,
          display: diagnosis.description
        }
      ] : undefined,
      text: diagnosis.description
    },
    recordedDate: diagnosis.createdAt ? diagnosis.createdAt.toISOString() : new Date().toISOString(),
    meta: {
      lastUpdated: diagnosis.updatedAt ? diagnosis.updatedAt.toISOString() : new Date().toISOString()
    }
  };
}

// --- CRUD Endpoints ---

// --- Patients ---
app.get('/Patient', async (req, res) => {
  try {
    const { name, gender, birthdate } = req.query;
    let query = {};
    
    if (name) {
      query.$or = [
        { first_name: new RegExp(name, 'i') },
        { last_name: new RegExp(name, 'i') }
      ];
    }
    if (gender) query.gender = gender;
    if (birthdate) query.date_of_birth = new Date(birthdate);
    
    const patients = await Patient.find(query).sort({ last_name: 1, first_name: 1 });
    
    res.json({
      resourceType: "Bundle",
      type: "searchset",
      total: patients.length,
      entry: patients.map(patient => ({
        resource: mapPatientToFHIR(patient)
      }))
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/Patient/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
      });
    }
    res.json(mapPatientToFHIR(patient));
  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/Patient', async (req, res) => {
  try {
    const patientData = {
      _id: req.body.id || new mongoose.Types.ObjectId().toString(),
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
      gender: req.body.gender,
      contact_number: req.body.contact_number
    };
    
    const patient = new Patient(patientData);
    await patient.save();
    res.status(201).json(mapPatientToFHIR(patient));
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(400).json({ error: err.message });
  }
});

app.put('/Patient/:id', async (req, res) => {
  try {
    const updateData = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
      gender: req.body.gender,
      contact_number: req.body.contact_number
    };
    
    const updated = await Patient.findByIdAndUpdate(req.params.id, updateData, { 
      new: true, 
      runValidators: true 
    });
    
    if (!updated) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
      });
    }
    
    res.json(mapPatientToFHIR(updated));
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/Patient/:id', async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
      });
    }
    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Encounters (Visits) ---
app.get('/Encounter', async (req, res) => {
  try {
    const { patient, date } = req.query;
    let query = {};
    
    if (patient) query.patient_id = patient;
    if (date) query.visit_date = new Date(date);
    
    const visits = await Visit.find(query).sort({ visit_date: -1 });
    
    res.json({
      resourceType: "Bundle",
      type: "searchset",
      total: visits.length,
      entry: visits.map(visit => ({
        resource: mapVisitToFHIR(visit)
      }))
    });
  } catch (err) {
    console.error('Error fetching encounters:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/Encounter/:id', async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Encounter not found" }]
      });
    }
    res.json(mapVisitToFHIR(visit));
  } catch (err) {
    console.error('Error fetching encounter:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Conditions (Diagnoses) ---
app.get('/Condition', async (req, res) => {
  try {
    const { patient, encounter, code } = req.query;
    let query = {};
    
    if (patient) query.patient_id = patient;
    if (encounter) query.visit_id = encounter;
    if (code) query.icd10_code = code;
    
    const diagnoses = await Diagnosis.find(query).sort({ createdAt: -1 });
    
    res.json({
      resourceType: "Bundle",
      type: "searchset",
      total: diagnoses.length,
      entry: diagnoses.map(diagnosis => ({
        resource: mapDiagnosisToFHIR(diagnosis)
      }))
    });
  } catch (err) {
    console.error('Error fetching conditions:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/Condition/:id', async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findById(req.params.id);
    if (!diagnosis) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Condition not found" }]
      });
    }
    res.json(mapDiagnosisToFHIR(diagnosis));
  } catch (err) {
    console.error('Error fetching condition:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Health check endpoint ---
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    resourceType: "OperationOutcome",
    issue: [{ 
      severity: "error", 
      code: "exception", 
      diagnostics: err.message 
    }]
  });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ 
    resourceType: "OperationOutcome",
    issue: [{ 
      severity: "error", 
      code: "not-found", 
      diagnostics: `Resource not found: ${req.method} ${req.path}` 
    }]
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FHIR API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET    /Patient - List all patients');
  console.log('  GET    /Patient/:id - Get patient by ID');
  console.log('  POST   /Patient - Create new patient');
  console.log('  PUT    /Patient/:id - Update patient');
  console.log('  DELETE /Patient/:id - Delete patient');
  console.log('  GET    /Encounter - List all encounters');
  console.log('  GET    /Encounter/:id - Get encounter by ID');
  console.log('  GET    /Condition - List all conditions');
  console.log('  GET    /Condition/:id - Get condition by ID');
  console.log('  GET    /health - Health check');
});*/

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Import models
const Patient = require('./models/Patient');
const Visit = require('./models/Visit');
const Diagnosis = require('./models/Diagnosis');

const app = express();
app.use(bodyParser.json());

// --- MongoDB connection ---
mongoose.connect('mongodb://localhost:27017/legacy_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected to legacy_db'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Helper functions to map MongoDB documents to FHIR resources ---

// Patient → FHIR Patient
function mapPatientToFHIR(patient) {
  return {
    resourceType: "Patient",
    id: patient._id,
    identifier: [
      {
        use: "usual",
        value: patient._id
      }
    ],
    name: [
      {
        use: "official",
        given: [patient.first_name],
        family: patient.last_name
      }
    ],
    birthDate: patient.date_of_birth ? patient.date_of_birth.toISOString().split('T')[0] : undefined,
    gender: patient.gender,
    telecom: patient.contact_number ? [
      {
        system: "phone",
        value: patient.contact_number,
        use: "mobile"
      }
    ] : undefined,
    meta: {
      lastUpdated: patient.updatedAt ? patient.updatedAt.toISOString() : new Date().toISOString()
    }
  };
}

// Visit → FHIR Encounter
function mapVisitToFHIR(visit) {
  return {
    resourceType: "Encounter",
    id: visit._id,
    identifier: [
      {
        use: "usual",
        value: visit._id
      }
    ],
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory"
    },
    subject: {
      reference: `Patient/${visit.patient_id}`,
      display: `Patient ${visit.patient_id}`
    },
    period: {
      start: visit.visit_date ? visit.visit_date.toISOString() : undefined
    },
    reasonCode: visit.reason ? [
      {
        text: visit.reason
      }
    ] : undefined,
    extension: visit.vitals ? [
      {
        url: "http://hl7.org/fhir/StructureDefinition/encounter-vitals",
        valueString: `HR: ${visit.vitals.heart_rate || 'N/A'}, BP: ${visit.vitals.blood_pressure || 'N/A'}`
      }
    ] : undefined,
    meta: {
      lastUpdated: visit.updatedAt ? visit.updatedAt.toISOString() : new Date().toISOString()
    }
  };
}

// Diagnosis → FHIR Condition
function mapDiagnosisToFHIR(diagnosis) {
  return {
    resourceType: "Condition",
    id: diagnosis._id,
    identifier: [
      {
        use: "usual",
        value: diagnosis._id
      }
    ],
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "Active"
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed"
        }
      ]
    },
    subject: {
      reference: `Patient/${diagnosis.patient_id}`,
      display: `Patient ${diagnosis.patient_id}`
    },
    encounter: {
      reference: `Encounter/${diagnosis.visit_id}`,
      display: `Encounter ${diagnosis.visit_id}`
    },
    code: {
      coding: diagnosis.icd10_code ? [
        {
          system: "http://hl7.org/fhir/sid/icd-10",
          code: diagnosis.icd10_code,
          display: diagnosis.description
        }
      ] : undefined,
      text: diagnosis.description
    },
    recordedDate: diagnosis.createdAt ? diagnosis.createdAt.toISOString() : new Date().toISOString(),
    meta: {
      lastUpdated: diagnosis.updatedAt ? diagnosis.updatedAt.toISOString() : new Date().toISOString()
    }
  };
}

// --- CRUD Endpoints ---

// --- Patients ---
app.get('/Patient', async (req, res) => {
  try {
    const { name, gender, birthdate } = req.query;
    let query = {};
    
    if (name) {
      query.$or = [
        { first_name: new RegExp(name, 'i') },
        { last_name: new RegExp(name, 'i') }
      ];
    }
    if (gender) query.gender = gender;
    if (birthdate) query.date_of_birth = new Date(birthdate);
    
    const patients = await Patient.find(query).sort({ last_name: 1, first_name: 1 });
    
    res.json({
      resourceType: "Bundle",
      type: "searchset",
      total: patients.length,
      entry: patients.map(patient => ({
        resource: mapPatientToFHIR(patient)
      }))
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/Patient/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
      });
    }
    res.json(mapPatientToFHIR(patient));
  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/Patient', async (req, res) => {
  try {
    const patientData = {
      _id: req.body.id || new mongoose.Types.ObjectId().toString(),
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
      gender: req.body.gender,
      contact_number: req.body.contact_number
    };
    
    const patient = new Patient(patientData);
    await patient.save();
    res.status(201).json(mapPatientToFHIR(patient));
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(400).json({ error: err.message });
  }
});

app.put('/Patient/:id', async (req, res) => {
  try {
    const updateData = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
      gender: req.body.gender,
      contact_number: req.body.contact_number
    };
    
    const updated = await Patient.findByIdAndUpdate(req.params.id, updateData, { 
      new: true, 
      runValidators: true 
    });
    
    if (!updated) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
      });
    }
    
    res.json(mapPatientToFHIR(updated));
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/Patient/:id', async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
      });
    }
    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Encounters (Visits) ---
app.get('/Encounter', async (req, res) => {
  try {
    const { patient, date } = req.query;
    let query = {};
    
    if (patient) query.patient_id = patient;
    if (date) query.visit_date = new Date(date);
    
    const visits = await Visit.find(query).sort({ visit_date: -1 });
    
    res.json({
      resourceType: "Bundle",
      type: "searchset",
      total: visits.length,
      entry: visits.map(visit => ({
        resource: mapVisitToFHIR(visit)
      }))
    });
  } catch (err) {
    console.error('Error fetching encounters:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/Encounter/:id', async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Encounter not found" }]
      });
    }
    res.json(mapVisitToFHIR(visit));
  } catch (err) {
    console.error('Error fetching encounter:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Conditions (Diagnoses) ---
app.get('/Condition', async (req, res) => {
  try {
    const { patient, encounter, code } = req.query;
    let query = {};
    
    if (patient) query.patient_id = patient;
    if (encounter) query.visit_id = encounter;
    if (code) query.icd10_code = code;
    
    const diagnoses = await Diagnosis.find(query).sort({ createdAt: -1 });
    
    res.json({
      resourceType: "Bundle",
      type: "searchset",
      total: diagnoses.length,
      entry: diagnoses.map(diagnosis => ({
        resource: mapDiagnosisToFHIR(diagnosis)
      }))
    });
  } catch (err) {
    console.error('Error fetching conditions:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/Condition/:id', async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findById(req.params.id);
    if (!diagnosis) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Condition not found" }]
      });
    }
    res.json(mapDiagnosisToFHIR(diagnosis));
  } catch (err) {
    console.error('Error fetching condition:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Health check endpoint ---
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    resourceType: "OperationOutcome",
    issue: [{ 
      severity: "error", 
      code: "exception", 
      diagnostics: err.message 
    }]
  });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ 
    resourceType: "OperationOutcome",
    issue: [{ 
      severity: "error", 
      code: "not-found", 
      diagnostics: `Resource not found: ${req.method} ${req.path}` 
    }]
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FHIR API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET    /Patient - List all patients');
  console.log('  GET    /Patient/:id - Get patient by ID');
  console.log('  POST   /Patient - Create new patient');
  console.log('  PUT    /Patient/:id - Update patient');
  console.log('  DELETE /Patient/:id - Delete patient');
  console.log('  GET    /Encounter - List all encounters');
  console.log('  GET    /Encounter/:id - Get encounter by ID');
  console.log('  GET    /Condition - List all conditions');
  console.log('  GET    /Condition/:id - Get condition by ID');
  console.log('  GET    /health - Health check');
});