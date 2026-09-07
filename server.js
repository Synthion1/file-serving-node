// --- MODULE IMPORTS ---
const http = require('http');           // built-in module to create the web server
const fs = require('fs');               // built-in module to read files from disk
const path = require('path');           // built-in module to safely build file paths
const mime = require('mime-types');     // determines the correct Content-Type for served files
const formidable = require('formidable'); // parses incoming file uploads (multipart/form-data)

// --- CONFIGURATION ---

// Folder where uploaded files will be saved
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Whitelist of safe file extensions — anything not on this list is rejected
const ALLOWED_TYPES = ['.png', '.jpg', '.jpeg', '.gif', '.txt', '.pdf'];

// Maximum allowed file size (10 megabytes), to prevent abuse/huge uploads
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// --- SERVER CREATION ---
const server = http.createServer((req, res) => {

    // --- UPLOAD ROUTE ---
    // Only runs when the request is a POST to /upload.
    // This check happens BEFORE the static file-serving logic below,
    // so file uploads are handled separately from normal page/file requests.
    if (req.method === 'POST' && req.url === '/upload') {

        // Configure formidable: where to save files, keep file extensions,
        // and enforce our size limit automatically
        const form = new formidable.IncomingForm({
            uploadDir: UPLOAD_DIR,
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE,
        });

        // Parse the incoming upload. This is asynchronous — formidable
        // handles reading the file stream and saving it to UPLOAD_DIR for us.
        form.parse(req, (err, fields, files) => {

            // Case 1: something went wrong during parsing
            // (e.g. the file exceeded MAX_FILE_SIZE)
            if (err) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Upload failed: ' + err.message);
            }

            // Case 2: no file was actually attached to the request
            const uploadedFile = files.file?.[0] || files.file;
            if (!uploadedFile) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('No file uploaded.');
            }

            // Extract the file's extension (e.g. ".exe", ".png") for validation
            const ext = path.extname(uploadedFile.originalFilename || '').toLowerCase();

            // Case 3: file type is not on our whitelist
            if (!ALLOWED_TYPES.includes(ext)) {
                // Delete the rejected file immediately so it doesn't
                // sit unused (and potentially unsafe) on the server's disk
                fs.unlink(uploadedFile.filepath, () => {});
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end(`File type "${ext}" not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
            }

            // Case 4: success — the file passed all checks and is
            // already saved in UPLOAD_DIR by formidable
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`File "${uploadedFile.originalFilename}" uploaded successfully!`);
        });

        // Stop here so the static-file-serving code below doesn't also
        // try to run for this same request
        return;
    }

    // --- STATIC FILE SERVING (original functionality) ---
    // Builds the path to the requested file inside the "public" folder.
    // If the request is for "/", default to serving index.html.
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);

    // Read the requested file from disk
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File doesn't exist — respond with a 404 page
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf8');
            } else {
                // Some other server-side error occurred
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            // File found — send it back with the correct MIME type
            // (e.g. text/html, text/css, image/png) so the browser
            // knows how to interpret it
            res.writeHead(200, { 'Content-Type': mime.lookup(filePath) });
            res.end(content, 'utf8');
        }
    });
});

// --- START THE SERVER ---
// Use the PORT environment variable if set (required for platforms like Render),
// otherwise default to 3000 for local development
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));