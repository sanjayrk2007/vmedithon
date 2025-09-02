// Get the raw CSV data from the source message
var csvData = connectorMessage.getRawData();

// Split the data into an array of lines
var lines = csvData.split('\n');

// The first line is the header
var headers = lines[0].split(',').map(function(header) {
    return header.trim();
});

var result = [];

// Iterate over the remaining lines (starting from the second line)
for (var i = 1; i < lines.length; i++) {
    var obj = {};
    var currentline = lines[i].split(',');

    // Map each header to its corresponding value for the current line
    for (var j = 0; j < headers.length; j++) {
        // Use a null check to handle potential empty values
        obj[headers[j]] = currentline[j] ? currentline[j].trim() : null;
    }

    result.push(obj);
}

// Convert the JavaScript array of objects into a formatted JSON string
// and assign it to the 'msg' variable, which is the message payload
// that gets passed to the destination.
msg = JSON.stringify(result, null, 2);
