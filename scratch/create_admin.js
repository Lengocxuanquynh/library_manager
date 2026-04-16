const fs = require('fs');

async function createAdmin() {
  // 1. Read .env file
  const envContent = fs.readFileSync('.env', 'utf-8');
  let apiKey = '';
  let projectId = '';

  envContent.split('\n').forEach(line => {
    if (line.trim().startsWith('NEXT_PUBLIC_FIREBASE_API_KEY')) {
      apiKey = line.split('=')[1].trim().replace(/['"]/g, '');
    }
    if (line.trim().startsWith('NEXT_PUBLIC_FIREBASE_PROJECT_ID')) {
      projectId = line.split('=')[1].trim().replace(/['"]/g, '');
    }
  });

  if (!apiKey || !projectId) {
    console.error("Missing Firebase Config in .env");
    return;
  }

  const email = "admin@library.vn";
  const password = "admin123";

  // 2. Create User in Firebase Auth
  console.log("Creating user in Firebase Auth...");
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  const authData = await authRes.json();
  if (authData.error) {
    if (authData.error.message === "EMAIL_EXISTS") {
      console.log("Account already exists. Proceeding to update role...");
      // To get token for existing user:
      const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      });
      const loginData = await loginRes.json();
      authData.localId = loginData.localId;
      authData.idToken = loginData.idToken;
    } else {
      console.error("Firebase Auth Error:", authData.error.message);
      return;
    }
  }

  const uid = authData.localId;
  const token = authData.idToken;
  console.log(`User UID: ${uid}`);

  // 3. Create document in Firestore 'users' collection
  console.log("Saving user role as Admin in Firestore...");
  const firestoreRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fields: {
        name: { stringValue: "System Admin" },
        email: { stringValue: email },
        role: { stringValue: "admin" },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  });

  const firestoreData = await firestoreRes.json();
  if (firestoreData.error) {
    console.error("Firestore Error:", firestoreData.error.message);
  } else {
    console.log("✅ Admin account created successfully!");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  }
}

createAdmin();
