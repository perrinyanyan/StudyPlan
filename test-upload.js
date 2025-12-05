// Test upload endpoint
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testUpload() {
    // Create a simple test file
    const testContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync('test.png', testContent);

    // Get JWT token first
    const loginRes = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
    });

    const loginData = await loginRes.json();
    console.log('Login response:', loginData);

    if (!loginData.token) {
        console.error('Failed to get token');
        return;
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream('test.png'), 'test.png');

    const uploadRes = await fetch('http://localhost:3000/upload/avatar', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${loginData.token}`,
            ...formData.getHeaders()
        },
        body: formData
    });

    const uploadData = await uploadRes.json();
    console.log('Upload response status:', uploadRes.status);
    console.log('Upload response:', uploadData);

    // Cleanup
    fs.unlinkSync('test.png');
}

testUpload().catch(console.error);
