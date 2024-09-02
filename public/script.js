document.addEventListener('DOMContentLoaded', () => {
    const generateEmailBtn = document.getElementById('generate-email');
    const messageList = document.getElementById('message-list');
    const messageModal = document.getElementById('message-modal');
    const modalContent = messageModal.querySelector('.modal-content');
    const messageDetails = document.getElementById('message-details');
    const closeMessageBtn = document.getElementById('close-message');
    const refreshMessagesBtn = document.getElementById('refresh-messages');
    const messageCount = document.getElementById('message-count');
    const tempEmailInput = document.getElementById('temp-email-input');
    const copyEmailBtn = document.getElementById('copy-email');
    const emailTimer = document.getElementById('emailTimer');
    const extendEmailBtn = document.getElementById('extend-email');
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    let csrfToken;
    let currentEmail;
    let emailExpirationTime = 0;
    let isManualRefresh = false;
    let currentTimerInterval;

    async function fetchCsrfToken() {
        try {
            const response = await fetch('/csrf-token');
            const data = await response.json();
            csrfToken = data.csrfToken;
        } catch (error) {
            console.error('Error fetching CSRF token:', error);
            showNotification('שגיאה בטעינת טוקן CSRF. נסה לרענן את הדף.', 'error');
        }
    }

    async function getCurrentEmail() {
        try {
            showLoading(true);
            const response = await fetch('/current-email', {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            currentEmail = data.email;
            emailExpirationTime = new Date(data.expirationTime).getTime();
            updateEmailDisplay(data.email);
            updateEmailTimer();
            fetchMessages();
        } catch (error) {
            console.error('Error fetching current email:', error);
            showNotification('שגיאה בטעינת כתובת המייל. נסה שוב מאוחר יותר.', 'error');
        } finally {
            showLoading(false);
        }
    }

    function updateEmailDisplay(email) {
        if (tempEmailInput) {
            tempEmailInput.textContent = email;
            showNotification('כתובת מייל חדשה נוצרה בהצלחה', 'success');
        } else {
            console.error('temp-email-input element not found');
        }
    }

    copyEmailBtn.addEventListener('click', () => {
        if (tempEmailInput) {
            navigator.clipboard.writeText(tempEmailInput.textContent).then(() => {
                showNotification('כתובת המייל הועתקה ללוח', 'success');
            });
        } else {
            console.error('temp-email-input element not found');
        }
    });

    fetchCsrfToken().then(() => {
        getCurrentEmail();
    });

    generateEmailBtn.addEventListener('click', async () => {
        try {
            showLoading(true);
            const response = await fetch('/generate-email', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            currentEmail = data.email;
            emailExpirationTime = new Date(data.expirationTime).getTime();
            updateEmailDisplay(data.email);
            updateEmailTimer();
            fetchMessages();
        } catch (error) {
            console.error('Error generating email:', error);
            showNotification('שגיאה ביצירת כתובת מייל זמנית. נסה שוב מאוחר יותר.', 'error');
        } finally {
            showLoading(false);
        }
    });

    refreshMessagesBtn.addEventListener('click', () => {
        isManualRefresh = true;
        showLoading(true);
        fetchMessages();
    });

    async function fetchMessages() {
        try {
            showLoading(true);
            const response = await fetch('/messages', {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            });
            if (response.status === 400) {
                // Email has expired, generate a new one
                await generateNewEmail();
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const messages = await response.json();
            const oldMessageCount = messageList.children.length;
            displayMessages(messages);
            if (isManualRefresh) {
                if (messages.length > oldMessageCount) {
                    showNotification('ההודעות עודכנו בהצלחה', 'info');
                } else {
                    showNotification('אין הודעות חדשות', 'info');
                }
                isManualRefresh = false;
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            if (isManualRefresh) {
                showNotification('שגיאה בטעינת ההודעות. נסה שוב מאוחר יותר.', 'error');
                isManualRefresh = false;
            }
        } finally {
            showLoading(false);
        }
    }

    async function generateNewEmail() {
        try {
            const response = await fetch('/generate-email', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            currentEmail = data.email;
            emailExpirationTime = new Date(data.expirationTime).getTime();
            updateEmailDisplay(data.email);
            updateEmailTimer();
            fetchMessages();
        } catch (error) {
            console.error('Error generating new email:', error);
            showNotification('שגיאה ביצירת כתובת מייל זמנית חדשה. נסה שוב מאוחר יותר.', 'error');
        }
    }

    function displayMessages(messages) {
        messageList.innerHTML = '';
        if (messages.length === 0) {
            messageList.innerHTML = '<li class="no-messages">אין הודעות חדשות</li>';
            if (isManualRefresh) {
                showNotification('אין הודעות חדשות', 'info');
            }
        } else {
            messages.forEach(message => {
                const li = document.createElement('li');
                li.className = 'message-item';
                const messageDate = new Date(message.mail_timestamp * 1000);
                const formattedDate = messageDate.toLocaleDateString('he-IL');
                const formattedTime = messageDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                li.innerHTML = `
                    <div class="message-sender">${escapeHtml(message.mail_from)}</div>
                    <div class="message-content">
                        <div class="message-subject">${escapeHtml(message.mail_subject)}</div>
                        <div class="message-preview">${escapeHtml(message.mail_excerpt)}</div>
                    </div>
                    <div class="message-time">
                        <span class="message-date">${formattedDate}</span>
                        <span class="message-hour">${formattedTime}</span>
                    </div>
                `;
                li.addEventListener('click', () => showMessageContent(message.mail_id));
                messageList.appendChild(li);
            });
        }
        messageList.classList.add('fade-in');
        messageCount.textContent = `${messages.length} הודעות`;
    }

    function closeModal() {
        messageModal.classList.remove('show');
        setTimeout(() => {
            messageModal.style.display = 'none';
        }, 300);
    }

    closeMessageBtn.addEventListener('click', closeModal);

    messageModal.addEventListener('click', (event) => {
        if (event.target === messageModal) {
            closeModal();
        }
    });

    async function showMessageContent(messageId) {
        try {
            showLoading(true);
            const response = await fetch(`/message/${messageId}`, {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const message = await response.json();
            const messageDate = new Date(message.mail_timestamp * 1000);
            const formattedDate = messageDate.toLocaleDateString('he-IL', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            messageDetails.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-subject">${escapeHtml(message.mail_subject)}</h2>
                    <div class="modal-metadata">
                        <span class="modal-metadata-label">מאת:</span>
                        <span>${escapeHtml(message.mail_from)}</span>
                        ${message.mail_to ? `
                            <span class="modal-metadata-label">אל:</span>
                            <span>${escapeHtml(message.mail_to)}</span>
                        ` : ''}
                        <span class="modal-metadata-label">תאריך:</span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div class="modal-body">${sanitizeHtml(message.mail_body)}</div>
            `;
            messageModal.style.display = 'block';
            setTimeout(() => {
                messageModal.classList.add('show');
            }, 10);
        } catch (error) {
            console.error('Error fetching message content:', error);
            showNotification('שגיאה בטעינת תוכן ההודעה. נסה שוב מאוחר יותר.', 'error');
        } finally {
            showLoading(false);
        }
    }

    function escapeHtml(unsafe) {
        if (unsafe === undefined || unsafe === null) {
            return '';
        }
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sanitizeHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText;
    }

    function showLoading(isLoading) {
        const buttons = document.querySelectorAll('.sidebar-btn, .copy-btn');
        buttons.forEach(button => {
            button.disabled = isLoading;
        });
    }

    function showNotification(message, type) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type}`;
            
            // Force a reflow before adding the 'show' class
            notification.offsetHeight;
            
            notification.classList.add('show');
            
            // Set a timeout to remove the notification after at least 3 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                
                // Wait for the transition to complete before hiding the notification
                setTimeout(() => {
                    notification.className = 'notification';
                }, 300);
            }, 3000);
        } else {
            console.error('Notification element not found');
        }
    }

    function clearCurrentTimer() {
        if (currentTimerInterval) {
            clearInterval(currentTimerInterval);
        }
    }

    function updateEmailTimer() {
        clearCurrentTimer();
        const updateTimer = () => {
            const timeLeft = Math.max(0, emailExpirationTime - Date.now());
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            emailTimer.textContent = `תוקף: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (timeLeft === 0) {
                clearCurrentTimer();
                showNotification('כתובת האימייל פגה. אנא צור כתובת חדשה.', 'warning');
            }
        };
        updateTimer();
        currentTimerInterval = setInterval(updateTimer, 1000);
    }

    extendEmailBtn.addEventListener('click', async () => {
        try {
            showLoading(true);
            const response = await fetch('/extend-email', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            emailExpirationTime = new Date(data.expirationTime).getTime();
            updateEmailTimer();
            showNotification('תוקף המייל הוארך ב-10 דקות נוספות', 'success');
        } catch (error) {
            console.error('Error extending email expiration:', error);
            showNotification('שגיאה בהארכת תוקף המייל. נסה שוב מאוחר יותר.', 'error');
        } finally {
            showLoading(false);
        }
    });

    themeToggle.addEventListener('click', () => {
        const currentTheme = themeToggle.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.setAttribute('data-theme', newTheme);
        themeToggle.setAttribute('data-theme', newTheme);
        
        // You can add more theme-related changes here if needed
    });

    // Check for saved theme preference or use the system preference
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "dark") {
        document.body.setAttribute("data-theme", "dark");
        themeToggle.setAttribute('data-theme', 'dark');
    } else if (currentTheme === "light") {
        document.body.setAttribute("data-theme", "light");
        themeToggle.setAttribute('data-theme', 'light');
    } else if (prefersDarkScheme.matches) {
        document.body.setAttribute("data-theme", "dark");
        themeToggle.setAttribute('data-theme', 'dark');
    } else {
        document.body.setAttribute("data-theme", "light");
        themeToggle.setAttribute('data-theme', 'light');
    }

    setInterval(() => {
        isManualRefresh = false;
        fetchMessages();
    }, 30000);
});