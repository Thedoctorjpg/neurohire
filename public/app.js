const TOTAL_STEPS = 4;
let currentStep = 1;

function goToStep(step) {
  if (step > currentStep + 1) return;
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !validateStep2()) return;
  if (step === 4) {
    if (!validateStep2()) {
      goToStep(2);
      return;
    }
    renderReview();
  }
  currentStep = step;
  document.querySelectorAll('.step-content').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === step);
  });
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const btn = document.getElementById('step-btn-' + i);
    const active = i === step;
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    btn.classList.toggle('step-active', active);
    btn.classList.toggle('bg-gray-200', !active);
    btn.classList.toggle('text-gray-700', !active);
  }
  document.getElementById('progress-bar').style.width = (step / TOTAL_STEPS * 100) + '%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep1() {
  const jobtitle = document.getElementById('jobtitle');
  const stage = document.querySelector('input[name="stage"]:checked');
  if (!jobtitle.value.trim()) {
    alert('Please enter a job title.');
    jobtitle.focus();
    return false;
  }
  if (!stage) {
    alert('Please select the stage where discrimination occurred.');
    return false;
  }
  return true;
}

function validateStep2() {
  const description = document.getElementById('description');
  if (!description.value.trim()) {
    alert('Please describe what happened.');
    description.focus();
    return false;
  }
  return true;
}

function checkedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
}

function fieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderReview() {
  const stage = document.querySelector('input[name="stage"]:checked');
  const lines = [
    ['Job title', fieldValue('jobtitle')],
    ['Company', fieldValue('company') || 'Not provided'],
    ['Stage', stage ? stage.value : '—'],
    ['Date', fieldValue('date') || 'Not provided'],
    ['Issue types', checkedValues('issue_type').join(', ') || 'Not specified'],
    ['What happened', fieldValue('description')],
    ['Accommodations', fieldValue('accommodations') || 'Not provided'],
    ['Impact', checkedValues('impact').join(', ') || 'Not specified'],
    ['Impact notes', fieldValue('impact_notes') || 'Not provided'],
    ['Support requested', fieldValue('support_requested')],
    ['Contact email', fieldValue('contact_email') || 'Anonymous submission'],
  ];
  document.getElementById('review-summary').innerHTML = lines
    .map(
      ([k, v]) =>
        `<div><span class="font-semibold text-gray-700">${k}:</span> <span class="text-gray-600">${escapeHtml(v).replace(/\n/g, '<br>')}</span></div>`
    )
    .join('');
}

function buildPayload() {
  return {
    company: fieldValue('company') || null,
    jobTitle: fieldValue('jobtitle'),
    stage: document.querySelector('input[name="stage"]:checked')?.value,
    incidentDate: fieldValue('date') || null,
    issueTypes: checkedValues('issue_type'),
    description: fieldValue('description'),
    accommodations: fieldValue('accommodations') || null,
    impacts: checkedValues('impact'),
    impactNotes: fieldValue('impact_notes') || null,
    supportRequested: fieldValue('support_requested'),
    contactEmail: fieldValue('contact_email') || null,
    consent: document.getElementById('consent').checked,
  };
}

document.getElementById('consent').addEventListener('change', function () {
  document.getElementById('submit-btn').disabled = !this.checked;
});

document.getElementById('neurohire-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!document.getElementById('consent').checked) return;

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildPayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Submission failed');

    const ref = document.getElementById('report-ref');
    if (ref && data.id) {
      ref.textContent = `Reference: ${data.id}`;
      ref.classList.remove('hidden');
    }
    document.getElementById('success-dialog').classList.remove('hidden');
  } catch (err) {
    alert(err.message || 'Something went wrong submitting your report. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit report';
  }
});