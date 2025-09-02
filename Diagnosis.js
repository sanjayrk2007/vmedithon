const mongoose = require('mongoose');

const diagnosisSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom string ID
  visit_id: { type: String, required: true, ref: 'Visit' },
  patient_id: { type: String, required: true, ref: 'Patient' },
  icd10_code: { type: String },
  description: { type: String, required: true }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for better query performance
diagnosisSchema.index({ visit_id: 1 });
diagnosisSchema.index({ patient_id: 1 });
diagnosisSchema.index({ icd10_code: 1 });

module.exports = mongoose.model('Diagnosis', diagnosisSchema);
