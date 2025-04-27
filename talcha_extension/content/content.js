console.log("Password Manager content script loaded on: " + window.location.href);
console.log("Setting up message listener for content script");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === 'autofill') {
    const { username, password } = request.credentials || {};
    console.log("Attempting to autofill username:", username);

    try {
      if (!username || !password) {
        throw new Error("Missing username or password in credentials");
      }

      // Find username and password fields
      const usernameFields = findUsernameFields();
      const passwordFields = findPasswordFields();

      console.log("Found username fields:", usernameFields.length);
      console.log("Found password fields:", passwordFields.length);

      let success = false;

      // Autofill them if found
      if (usernameFields.length > 0) {
        fillField(usernameFields[0], username);
        console.log("Username field filled");
        success = true;
      } else {
        console.warn("No suitable username fields found");
      }

      if (passwordFields.length > 0) {
        fillField(passwordFields[0], password);
        console.log("Password field filled");
        success = true;
      } else {
        console.warn("No password fields found");
      }

      sendResponse({ success, message: success ? "Autofill completed" : "No fields filled" });
    } catch (error) {
      console.error("Autofill error:", error);
      sendResponse({ success: false, error: error.message });
    }
  } else {
    console.warn("Unknown action received:", request.action);
    sendResponse({ success: false, error: "Unknown action: " + request.action });
  }

  return true; // Keep the message channel open for async responses
});

// Function to find username input fields
function findUsernameFields() {
  const selectors = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="login" i]',
    // Generic fallback (last resort)
    'input[type="text"]'
  ];

  const fields = new Set(); // Avoid duplicates

  selectors.forEach((selector, index) => {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector ${selector} found ${elements.length} elements`);

    elements.forEach(element => {
      // Skip hidden, disabled, or irrelevant fields
      if (!element.offsetParent || element.disabled) {
        console.log(`Skipping hidden/disabled element: ${element.name || element.id}`);
        return;
      }
      if (
        element.type === 'text' &&
        (element.name.toLowerCase().includes('search') ||
          element.name.toLowerCase().includes('query') ||
          element.id.toLowerCase().includes('search') ||
          element.id.toLowerCase().includes('query'))
      ) {
        console.log(`Skipping search/query element: ${element.name || element.id}`);
        return;
      }

      fields.add(element); // Use Set to prevent duplicates
    });
  });

  const sortedFields = Array.from(fields).sort((a, b) => {
    // Prioritize fields with autocomplete or specific names
    const aScore = scoreField(a);
    const bScore = scoreField(b);
    return bScore - aScore; // Higher score first
  });

  console.log("Sorted username fields:", sortedFields.length);
  return sortedFields;
}

// Helper function to score fields for sorting
function scoreField(field) {
  let score = 0;
  if (field.autocomplete === 'username' || field.autocomplete === 'email') score += 10;
  if (field.type === 'email') score += 8;
  if (field.name.toLowerCase().includes('email')) score += 7;
  if (field.name.toLowerCase().includes('user')) score += 6;
  if (field.name.toLowerCase().includes('login')) score += 5;
  if (field.id.toLowerCase().includes('email')) score += 4;
  if (field.id.toLowerCase().includes('user')) score += 3;
  if (field.id.toLowerCase().includes('login')) score += 2;
  return score;
}

// Function to find password input fields
function findPasswordFields() {
  const passwordFields = Array.from(document.querySelectorAll('input[type="password"]')).filter(
    field => !field.disabled && field.offsetParent
  );
   // Visible and enabled

  console.log(`Found ${passwordFields.length} password fields on the page`);
  return passwordFields;
}

// Function to fill a field with value
function fillField(field, value) {
  try {
    field.focus();
    field.value = value;

    // Trigger events for modern frameworks (React, Angular, etc.)
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    field.dispatchEvent(inputEvent);
    field.dispatchEvent(changeEvent);

    // Additional events for edge cases
    field.dispatchEvent(new Event('blur', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    console.log(`Filled field ${field.name || field.id} with value`);
  } catch (error) {
    console.error(`Error filling field ${field.name || field.id}:`, error);
    throw error;
  }
}

// Log initialization completion
console.log("Content script initialization complete");