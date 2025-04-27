// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getCredentials") {
      fetchCredentialsFromServer(request.domain)
        .then(credentials => {
          sendResponse({ success: true, credentials });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Required for async response
    }
    
    if (request.action === "generatePassword") {
      const password = generateStrongPassword(request.length || 16);
      sendResponse({ success: true, password });
      return true;
    }
  });
  
  // Function to fetch credentials from your local server
  async function fetchCredentialsFromServer(domain) {
    try {
      // Replace with your actual API endpoint
      const response = await fetch(`http://localhost:3000/api/credentials?domain=${encodeURIComponent(domain)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Include cookies if using session-based auth
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching credentials:', error);
      throw error;
    }
  }
  
  // Password generator function
  function generateStrongPassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + special;
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += special.charAt(Math.floor(Math.random() * special.length));
    
    // Fill the rest of the password
    for (let i = 4; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    return password;
  }