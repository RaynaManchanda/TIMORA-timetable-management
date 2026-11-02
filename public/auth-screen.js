/**
 * TIMORA - Sign in and create account screens
 *
 * Owns everything on the authentication screen: switching between the two forms,
 * validation, calling the API and showing errors. When a user is signed in it
 * announces it with a "timora:authenticated" event; the application controller
 * (app.js) listens for that event and starts the session.
 *
 * Events consumed:  timora:signed-out, timora:session-expired
 * Events dispatched: timora:authenticated  (detail: { token, user })
 */

const MIN_PASSWORD_LENGTH = 8;
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** Messages for failures the user should understand and can act on. */
const MESSAGES = Object.freeze({
  network: 'Cannot reach the server. Check your connection and try again.',
  unexpected: 'Something went wrong. Please try again.',
  emailTaken: 'An account with this email already exists.',
  sectionsFailed: 'Could not load sections'
});

const loginForm = document.getElementById('form-signin');
const signupForm = document.getElementById('form-signup');
const notice = document.getElementById('auth-notice');
const loginAlert = document.getElementById('login-error');
const signupAlert = document.getElementById('signup-error');
const sectionSelect = document.getElementById('signup-section');

/** Maps a server validation message to the signup field it belongs to. */
const SIGNUP_FIELD_BY_PREFIX = Object.freeze([
  ['name', 'signup-name'],
  ['a valid email', 'signup-email'],
  ['email', 'signup-email'],
  ['password', 'signup-password'],
  ['sectionId', 'signup-section']
]);

/* -------------------------------------------------------------------------- */
/* Small DOM helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Show or hide an element using the hidden attribute.
 *
 * @param {HTMLElement} element Element to toggle.
 * @param {boolean} isVisible Whether it should be visible.
 * @returns {void}
 */
function setVisible(element, isVisible) {
  element.hidden = !isVisible;
}

/**
 * Show a message in an alert box above a form, or hide the box when there is none.
 *
 * @param {HTMLElement} alertBox Alert element.
 * @param {string[]} messages Messages to show, one per line.
 * @returns {void}
 */
function showAlert(alertBox, messages) {
  alertBox.replaceChildren(
    ...messages.map((text) => Object.assign(document.createElement('p'), { textContent: text }))
  );
  setVisible(alertBox, messages.length > 0);
}

/**
 * Show or clear the error under one field and mark the input as invalid.
 * Fields without an error slot (radio buttons, optional inputs) are ignored.
 *
 * @param {string} inputId Input element id.
 * @param {string} message Error text, or an empty string to clear it.
 * @returns {void}
 */
function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(`${inputId}-error`);
  if (!input || !error) return;

  input.setAttribute('aria-invalid', String(Boolean(message)));
  error.textContent = message;
  setVisible(error, Boolean(message));
}

/**
 * Clear every error message inside a form and in its alert box.
 *
 * @param {HTMLFormElement} form Form to reset.
 * @param {HTMLElement} alertBox Alert box belonging to the form.
 * @returns {void}
 */
function clearErrors(form, alertBox) {
  form.querySelectorAll('input, select').forEach((input) => setFieldError(input.id, ''));
  showAlert(alertBox, []);
}

/**
 * Put a submit button into or out of its loading state.
 *
 * @param {HTMLButtonElement} button Submit button.
 * @param {boolean} isLoading Whether a request is in progress.
 * @param {string} idleLabel Text to show when not loading.
 * @param {string} busyLabel Text to show while loading.
 * @returns {void}
 */
function setLoading(button, isLoading, idleLabel, busyLabel) {
  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  button.querySelector('.btn-text').textContent = isLoading ? busyLabel : idleLabel;
}

/**
 * Show a banner message at the top of the card, or hide it.
 *
 * @param {string} text Message to show, or an empty string to hide it.
 * @returns {void}
 */
function setNotice(text) {
  notice.textContent = text;
  setVisible(notice, Boolean(text));
}

/* -------------------------------------------------------------------------- */
/* Views                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Show the sign in or the create account form and focus its first field.
 *
 * @param {'login' | 'signup'} viewName View to show.
 * @returns {void}
 */
function showView(viewName) {
  document.querySelectorAll('[data-auth-view]').forEach((view) => {
    setVisible(view, view.dataset.authView === viewName);
  });

  const firstField = document.querySelector(`[data-auth-view="${viewName}"] input:not([type="radio"])`);
  firstField?.focus({ preventScroll: true });
}

/**
 * Return both forms to their starting state.
 *
 * @returns {void}
 */
function resetForms() {
  loginForm.reset();
  signupForm.reset();
  clearErrors(loginForm, loginAlert);
  clearErrors(signupForm, signupAlert);
  updateRoleFields();
  renderPasswordFeedback('');
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * POST JSON to the API and return the parsed response without throwing on HTTP errors.
 * A network failure is reported as status 0.
 *
 * @param {string} url Endpoint path.
 * @param {object} body Request body.
 * @returns {Promise<{ ok: boolean, status: number, data: object }>}
 */
async function postJson(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { message: MESSAGES.network } };
  }
}

/**
 * Turn a failed API response into messages for the user.
 *
 * @param {{ status: number, data: object }} result Failed response.
 * @returns {string[]}
 */
function describeFailure({ status, data }) {
  if (status === 0) return [MESSAGES.network];
  if (Array.isArray(data.validationErrors) && data.validationErrors.length > 0) return data.validationErrors;
  if (status >= 500) return [MESSAGES.unexpected];
  return [data.message || data.error || MESSAGES.unexpected];
}

/**
 * Tell the application a user is now signed in.
 *
 * @param {{ token: string, user: object }} session Session returned by the login endpoint.
 * @returns {void}
 */
function completeSignIn({ token, user }) {
  window.dispatchEvent(new CustomEvent('timora:authenticated', { detail: { token, user } }));
  resetForms();
  setNotice('');
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Check whether a value looks like an email address.
 *
 * @param {string} value Raw input.
 * @returns {boolean}
 */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Evaluate a password against each rule of the password policy.
 *
 * @param {string} password Candidate password.
 * @returns {{ length: boolean, lower: boolean, upper: boolean, digit: boolean }}
 */
function checkPasswordRules(password) {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password)
  };
}

/**
 * Update the rule checklist and strength bar as the user types a password.
 *
 * @param {string} password Current password input.
 * @returns {void}
 */
function renderPasswordFeedback(password) {
  const rules = checkPasswordRules(password);
  document.querySelectorAll('#signup-password-rules [data-rule]').forEach((item) => {
    item.classList.toggle('is-met', rules[item.dataset.rule]);
  });

  const metCount = Object.values(rules).filter(Boolean).length;
  const bar = document.getElementById('password-strength-bar');
  bar.style.width = `${(metCount / 4) * 100}%`;
  bar.dataset.level = password ? String(metCount) : '0';
}

/**
 * Validate the sign in form and show an error under each invalid field.
 *
 * @returns {boolean} True when the form can be submitted.
 */
function validateLoginForm() {
  const email = loginForm.elements.email.value;
  const password = loginForm.elements.password.value;

  const emailError = isValidEmail(email) ? '' : 'Enter a valid email address.';
  const passwordError = password ? '' : 'Enter your password.';
  setFieldError('signin-email', emailError);
  setFieldError('signin-password', passwordError);

  return !emailError && !passwordError;
}

/**
 * Validate the create account form and show an error under each invalid field.
 *
 * @returns {boolean} True when the form can be submitted.
 */
function validateSignupForm() {
  const { name, email, password, confirm, sectionId } = signupForm.elements;
  const isStudent = getSelectedRole() === 'STUDENT';
  const rules = checkPasswordRules(password.value);

  const errors = {
    'signup-name': name.value.trim() ? '' : 'Enter your full name.',
    'signup-email': isValidEmail(email.value) ? '' : 'Enter a valid email address.',
    'signup-section': isStudent && !sectionId.value ? 'Choose your section.' : '',
    'signup-password': Object.values(rules).every(Boolean) ? '' : 'Your password does not meet all the requirements.',
    'signup-confirm': confirm.value === password.value ? '' : 'The passwords do not match.'
  };

  Object.entries(errors).forEach(([inputId, message]) => setFieldError(inputId, message));

  const firstInvalid = Object.keys(errors).find((inputId) => errors[inputId]);
  if (firstInvalid) document.getElementById(firstInvalid).focus();
  return !firstInvalid;
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Submit the sign in form.
 *
 * @param {SubmitEvent} event Form submit event.
 * @returns {Promise<void>}
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  clearErrors(loginForm, loginAlert);
  setNotice('');
  if (!validateLoginForm()) return;

  const button = document.getElementById('btn-submit-signin');
  setLoading(button, true, 'Sign in', 'Signing in...');

  const result = await postJson('/api/auth/login', {
    email: loginForm.elements.email.value.trim(),
    password: loginForm.elements.password.value
  });

  setLoading(button, false, 'Sign in', 'Signing in...');

  if (!result.ok) {
    showAlert(loginAlert, describeFailure(result));
    if (result.status === 401) loginForm.elements.password.select();
    return;
  }

  completeSignIn(result.data);
}

/* -------------------------------------------------------------------------- */
/* Create account                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read the role chosen in the create account form.
 *
 * @returns {'STUDENT' | 'FACULTY'}
 */
function getSelectedRole() {
  return signupForm.querySelector('input[name="signup-role"]:checked').value;
}

/**
 * Show the section picker for students and the department field for faculty.
 *
 * @returns {void}
 */
function updateRoleFields() {
  const isStudent = getSelectedRole() === 'STUDENT';
  setVisible(document.getElementById('signup-section-group'), isStudent);
  setVisible(document.getElementById('signup-department-group'), !isStudent);
}

/**
 * Fill the section dropdown from the list of sections.
 *
 * @returns {Promise<void>}
 */
async function loadSections() {
  try {
    const response = await fetch('/api/academic/sections');
    const { sections = [] } = await response.json();
    const options = sections.map(({ id, name }) => new Option(name, id));
    sectionSelect.replaceChildren(new Option('Select your section', ''), ...options);
  } catch {
    sectionSelect.replaceChildren(new Option(MESSAGES.sectionsFailed, ''));
  }
}

/**
 * Show server validation messages next to the fields they describe.
 * Messages that do not match a field are shown in the alert box instead.
 *
 * @param {string[]} messages Validation messages from the server.
 * @returns {void}
 */
function showServerValidation(messages) {
  const unmatched = [];

  messages.forEach((message) => {
    const match = SIGNUP_FIELD_BY_PREFIX.find(([prefix]) => message.startsWith(prefix));
    if (match) {
      setFieldError(match[1], message);
    } else {
      unmatched.push(message);
    }
  });

  showAlert(signupAlert, unmatched);
}

/**
 * Submit the create account form: register, then sign the new user straight in.
 *
 * @param {SubmitEvent} event Form submit event.
 * @returns {Promise<void>}
 */
async function handleSignupSubmit(event) {
  event.preventDefault();
  clearErrors(signupForm, signupAlert);
  if (!validateSignupForm()) return;

  const button = document.getElementById('btn-submit-signup');
  setLoading(button, true, 'Create account', 'Creating account...');

  const { name, email, password, sectionId, department } = signupForm.elements;
  const role = getSelectedRole();
  const credentials = { email: email.value.trim(), password: password.value };

  const registration = await postJson('/api/auth/register', {
    name: name.value.trim(),
    ...credentials,
    role,
    ...(role === 'STUDENT' ? { sectionId: sectionId.value } : { department: department.value.trim() || undefined })
  });

  if (!registration.ok) {
    setLoading(button, false, 'Create account', 'Creating account...');
    if (registration.status === 409) {
      setFieldError('signup-email', `${MESSAGES.emailTaken} Try signing in instead.`);
      email.focus();
    } else if (registration.status === 400) {
      showServerValidation(describeFailure(registration));
    } else {
      showAlert(signupAlert, describeFailure(registration));
    }
    return;
  }

  const login = await postJson('/api/auth/login', credentials);
  setLoading(button, false, 'Create account', 'Creating account...');

  if (!login.ok) {
    // The account exists, so send the user to sign in rather than leaving them stuck.
    showView('login');
    loginForm.elements.email.value = credentials.email;
    setNotice('Your account was created. Please sign in.');
    return;
  }

  completeSignIn(login.data);
}

/* -------------------------------------------------------------------------- */
/* Wiring                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Let users reveal or hide what they typed in a password field.
 *
 * @param {HTMLButtonElement} toggle Show/Hide button.
 * @returns {void}
 */
function togglePasswordVisibility(toggle) {
  const input = document.getElementById(toggle.dataset.togglePassword);
  const willShow = input.type === 'password';
  input.type = willShow ? 'text' : 'password';
  toggle.textContent = willShow ? 'Hide' : 'Show';
  toggle.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
}

/**
 * Show the one-click demo account helper when running on a local machine.
 *
 * @returns {void}
 */
function initDemoAccounts() {
  const demo = document.getElementById('demo-accounts');
  if (!LOCAL_HOSTS.includes(window.location.hostname)) return;

  setVisible(demo, true);
  demo.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-demo-email]');
    if (!chip) return;
    loginForm.elements.email.value = chip.dataset.demoEmail;
    loginForm.elements.password.value = 'Password123!';
    loginForm.elements.password.focus();
  });
}

/**
 * Attach all event listeners for the authentication screen.
 *
 * @returns {void}
 */
function initAuthScreen() {
  if (!loginForm || !signupForm) return;

  loginForm.addEventListener('submit', handleLoginSubmit);
  signupForm.addEventListener('submit', handleSignupSubmit);

  document.querySelectorAll('[data-auth-switch]').forEach((button) => {
    button.addEventListener('click', () => {
      setNotice('');
      showView(button.dataset.authSwitch);
    });
  });

  document.querySelectorAll('[data-toggle-password]').forEach((toggle) => {
    toggle.addEventListener('click', () => togglePasswordVisibility(toggle));
  });

  signupForm.querySelectorAll('input[name="signup-role"]').forEach((radio) => {
    radio.addEventListener('change', updateRoleFields);
  });
  signupForm.elements.password.addEventListener('input', (event) => renderPasswordFeedback(event.target.value));

  window.addEventListener('timora:signed-out', () => {
    resetForms();
    showView('login');
    setNotice('You have been signed out.');
  });
  window.addEventListener('timora:session-expired', () => {
    resetForms();
    showView('login');
    setNotice('Your session has expired. Please sign in again.');
  });

  initDemoAccounts();
  updateRoleFields();
  loadSections();
}

initAuthScreen();
