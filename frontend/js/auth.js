// js/auth.js - Authentication Pages Logic

// Login Page
function renderLogin() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container">
            <div class="auth-container">
                <h2>Login to PetRehome</h2>
                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="login-email" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="login-password" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Login</button>
                </form>
                <p class="mt-md">
                    Don't have an account? <a href="/#register">Register here</a>
                </p>
                <p class="mt-sm">
                    <a href="/#forgot-password">Forgot Password?</a>
                </p>
            </div>
        </div>
    `;
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    window.utils.showLoading();
    
    try {
        const data = await API.login({ email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.utils.showToast('Login successful!', 'success');
        setTimeout(() => {
            window.location.hash = '/';
        }, 1000);
    } catch (error) {
        window.utils.showToast(error.message || 'Login failed', 'error');    } finally {
        window.utils.hideLoading();
    }
}

// Register Page
function renderRegister() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container">
            <div class="auth-container">
                <h2>Create Account</h2>
                <form id="register-form">
                    <div class="form-group">
                        <label class="form-label">Full Name</label>
                        <input type="text" id="reg-name" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="reg-email" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" id="reg-phone" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="reg-password" class="form-input" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm Password</label>
                        <input type="password" id="reg-confirm-password" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Register</button>
                </form>
                <p class="mt-md">
                    Already have an account? <a href="/#login">Login here</a>
                </p>
            </div>
        </div>
    `;
    
    document.getElementById('register-form').addEventListener('submit', handleRegister);
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    if (password !== confirmPassword) {
        window.utils.showToast('Passwords do not match', 'error');
        return;
    }
    
    window.utils.showLoading();
    
    try {
        const data = await API.register({ name, email, phone, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.utils.showToast('Registration successful!', 'success');
        setTimeout(() => {
            window.location.hash = '/';
        }, 1000);
    } catch (error) {
        window.utils.showToast(error.message || 'Registration failed', 'error');
    } finally {
        window.utils.hideLoading();
    }
}

// Forgot Password Page
function renderForgotPassword() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container">
            <div class="auth-container">
                <h2>Forgot Password</h2>
                <p>Enter your email address and we'll send you a link to reset your password.</p>
                <form id="forgot-password-form">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="forgot-email" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Send Reset Link</button>
                </form>
                <p class="mt-md">
                    <a href="/#login">Back to Login</a>
                </p>
            </div>
        </div>
    `;
    
    document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);
}
async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    
    window.utils.showLoading();
    
    try {
        await API.forgotPassword({ email });
        window.utils.showToast('Check your email for reset instructions', 'success');
        document.getElementById('forgot-password-form').reset();
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to send reset link', 'error');
    } finally {
        window.utils.hideLoading();
    }
}

// Reset Password Page
function renderResetPassword() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        document.getElementById('main-content').innerHTML = `
            <div class="container">
                <div class="auth-container">
                    <h2>Invalid Reset Link</h2>
                    <p>The reset link is invalid or has expired.</p>
                    <a href="/#forgot-password" class="btn btn-primary">Request New Link</a>
                </div>
            </div>
        `;
        return;
    }
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container">
            <div class="auth-container">
                <h2>Reset Password</h2>
                <form id="reset-password-form">
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input type="password" id="new-password" class="form-input" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm New Password</label>
                        <input type="password" id="confirm-new-password" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Reset Password</button>                </form>
            </div>
        </div>
    `;
    
    document.getElementById('reset-password-form').addEventListener('submit', (e) => handleResetPassword(e, token));
}

async function handleResetPassword(e, token) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    
    if (newPassword !== confirmNewPassword) {
        window.utils.showToast('Passwords do not match', 'error');
        return;
    }
    
    window.utils.showLoading();
    
    try {
        await API.resetPassword({ token, newPassword });
        window.utils.showToast('Password reset successful! Please login.', 'success');
        setTimeout(() => {
            window.location.hash = '/login';
        }, 2000);
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to reset password', 'error');
    } finally {
        window.utils.hideLoading();
    }
}