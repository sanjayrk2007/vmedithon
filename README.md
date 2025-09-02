# FHIR API Middleware

A Node.js + Express + Mongoose project that provides FHIR-compliant API endpoints for a legacy MongoDB database.

## Features

- **FHIR Resource Mapping**: Maps MongoDB collections to FHIR resources
  - Patients → Patient
  - Visits → Encounter  
  - Diagnoses → Condition
- **CRUD Operations**: Full Create, Read, Update, Delete operations for Patient resources
- **Search Capabilities**: Query patients by name, gender, birthdate
- **Proper FHIR Structure**: Returns FHIR-compliant JSON responses
- **Error Handling**: Comprehensive error handling with FHIR OperationOutcome responses

## Database Schema

### Patients Collection
- `_id` (string) - Primary key
- `first_name` (string, required)
- `last_name` (string, required)
- `date_of_birth` (Date)
- `gender` (enum: male, female, other, unknown)
- `contact_number` (string)

### Visits Collection
- `_id` (string) - Primary key
- `patient_id` (string, required, references Patients._id)
- `visit_date` (Date)
- `reason` (string)
- `vitals` (object with heart_rate, blood_pressure)

### Diagnoses Collection
- `_id` (string) - Primary key
- `visit_id` (string, required, references Visits._id)
- `patient_id` (string, required, references Patients._id)
- `icd10_code` (string)
- `description` (string, required)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure MongoDB is running locally on port 27017

3. Start the server:
```bash
npm start
```

The server will start on http://localhost:3000

## API Endpoints

### Patient Resources
- `GET /Patient` - List all patients (supports query parameters: name, gender, birthdate)
- `GET /Patient/:id` - Get patient by ID
- `POST /Patient` - Create new patient
- `PUT /Patient/:id` - Update patient
- `DELETE /Patient/:id` - Delete patient

### Encounter Resources (Visits)
- `GET /Encounter` - List all encounters (supports query parameters: patient, date)
- `GET /Encounter/:id` - Get encounter by ID

### Condition Resources (Diagnoses)
- `GET /Condition` - List all conditions (supports query parameters: patient, encounter, code)
- `GET /Condition/:id` - Get condition by ID

### Utility
- `GET /health` - Health check endpoint

## Example Usage

### Create a Patient
```bash
curl -X POST http://localhost:3000/Patient \
  -H "Content-Type: application/json" \
  -d '{
    "id": "patient001",
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1990-01-15",
    "gender": "male",
    "contact_number": "+1234567890"
  }'
```

### Search Patients
```bash
curl "http://localhost:3000/Patient?name=Doe&gender=male"
```

### Get Patient by ID
```bash
curl http://localhost:3000/Patient/patient001
```

## FHIR Compliance

The API returns FHIR-compliant JSON responses with proper resource structure, identifiers, and metadata. All responses include appropriate HTTP status codes and error handling using FHIR OperationOutcome resources.

## Database Connection

The application connects to MongoDB database named "legacy_db" on localhost:27017 with no authentication required.
