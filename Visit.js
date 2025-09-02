const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom string ID
  patient_id: { type: String, required: true, ref: 'Patient' },
  visit_date: { type: Date, default: Date.now },
  reason: { type: String },
  vitals: {
    heart_rate: { type: Number, min: 0, max: 300 },
    blood_pressure: { type: String } // Format: "120/80"
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for better query performance
visitSchema.index({ patient_id: 1 });
visitSchema.index({ visit_date: 1 });

module.exports = mongoose.model('Visit', visitSchema);
