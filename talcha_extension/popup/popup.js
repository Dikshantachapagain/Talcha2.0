document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab information
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  const url = new URL(currentTab.url);
  const domain = url.hostname;

  console.log('Current domain:', domain);

  // Display current domain
  document.getElementById('current-domain').textContent = domain;

  // Check for saved credentials
  chrome.runtime.sendMessage(
    { action: 'getCredentials', domain },
    (response) => {
      console.log('Full credentials response:', response);

      if (response && response.success) {
        // Fix: The nested credentials structure
        const credentialsData = response.credentials && response.credentials.credentials;

        console.log('Actual credentials array:', credentialsData);

        if (credentialsData && credentialsData.length > 0) {
          console.log('Found credential:', credentialsData[0]);

          // Show credentials
          const credential = credentialsData[0]; // Take the first one
          document.getElementById('username').textContent = credential.username;
          document.getElementById('password').value = credential.password;
          document.getElementById('found-credentials').classList.remove('hidden');
          document.getElementById('no-credentials').classList.add('hidden');
        } else {
          console.log('No credentials found in the response');
          // No credentials found
          document.getElementById('found-credentials').classList.add('hidden');
          document.getElementById('no-credentials').classList.remove('hidden');
        }
      } else {
        console.error('Error in credentials response:', response ? response.error : 'No response');
        // Error or no credentials found
        document.getElementById('found-credentials').classList.add('hidden');
        document.getElementById('no-credentials').classList.remove('hidden');
      }
    }
  );

  // Show/hide password
  document.getElementById('show-password').addEventListener('click', () => {
    const passwordInput = document.getElementById('password');
    const showBtn = document.getElementById('show-password');

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      showBtn.textContent = 'Hide';
    } else {
      passwordInput.type = 'password';
      showBtn.textContent = 'Show';
    }
  });

  // Copy password to clipboard
  document.getElementById('copy-password').addEventListener('click', () => {
    const passwordInput = document.getElementById('password');
    navigator.clipboard.writeText(passwordInput.value);
    showNotification('Password copied to clipboard');
  });

  // Autofill credentials
  document.getElementById('autofill').addEventListener('click', async () => {
    const username = document.getElementById('username').textContent;
    const password = document.getElementById('password').value;

    console.log('Sending autofill message with username:', username);

    // Get the current active tab again to ensure accuracy
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    // Check if the tab supports content scripts
    if (!currentTab.url || currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('about:')) {
      showNotification('Cannot autofill on this page (restricted URL).');
      console.error('Autofill not supported on:', currentTab.url);
      return;
    }

    // Retry sending the message up to 3 times
    const trySendMessage = (attempts = 3, delay = 500) => {
      chrome.tabs.sendMessage(
        currentTab.id,
        {
          action: 'autofill',
          credentials: { username, password }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(`Runtime error (attempts left: ${attempts}):`, chrome.runtime.lastError.message);
            if (attempts > 1) {
              setTimeout(() => trySendMessage(attempts - 1, delay), delay);
            } else {
              showNotification('Failed to autofill: Content script not available.');
            }
            return;
          }

          if (response && response.success) {
            showNotification('Credentials autofilled');
          } else {
            showNotification(
              'Failed to autofill credentials: ' +
                (response && response.error ? response.error : 'Unknown error')
            );
          }
        }
      );
    };

    trySendMessage();
  });

  // Generate password
  document.getElementById('generate-btn').addEventListener('click', () => {
    const length = parseInt(document.getElementById('password-length').value, 10);

    chrome.runtime.sendMessage(
      { action: 'generatePassword', length },
      (response) => {
        if (response.success) {
          document.getElementById('generated-password').value = response.password;
        } else {
          showNotification('Failed to generate password: ' + (response.error || 'Unknown error'));
        }
      }
    );
  });

  // Copy generated password
  document.getElementById('copy-generated').addEventListener('click', () => {
    const passwordInput = document.getElementById('generated-password');
    if (passwordInput.value) {
      navigator.clipboard.writeText(passwordInput.value);
      showNotification('Password copied to clipboard');
    } else {
      showNotification('No password to copy');
    }
  });

  // Save generated password
  document.getElementById('save-generated').addEventListener('click', async () => {
    const password = document.getElementById('generated-password').value;
    if (!password) {
      showNotification('No password to save');
      return;
    }

    // TODO: Implement save functionality by sending to your local server
    showNotification('Feature coming soon: Save password');
  });

  // Open main password manager
  document.getElementById('open-manager').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });

  // Enhanced notification function with custom UI
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '10px';
    notification.style.right = '10px';
    notification.style.padding = '10px';
    notification.style.backgroundColor = '#333';
    notification.style.color = '#fff';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
});