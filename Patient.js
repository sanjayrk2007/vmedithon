const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom string ID
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  date_of_birth: { type: Date },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other', 'unknown'],
    default: 'unknown'
  },
  contact_number: { type: String }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for better query performance
patientSchema.index({ first_name: 1, last_name: 1 });
patientSchema.index({ date_of_birth: 1 });

module.exports = mongoose.model('Patient', patientSchema);
