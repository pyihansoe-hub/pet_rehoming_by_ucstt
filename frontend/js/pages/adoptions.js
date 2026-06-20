// js/pages/adoptions.js - Adoption Requests Page Logic

async function renderAdoptions() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <h1>Adoption Requests</h1>
            
            <div class="flex gap-md mb-lg" style="border-bottom: 1px solid var(--border-color);">
                <button onclick="switchAdoptionTab('sent')" id="tab-sent" class="btn btn-outline" style="border-bottom: none; border-radius: 0;">Sent Requests</button>
                <button onclick="switchAdoptionTab('received')" id="tab-received" class="btn btn-outline" style="border-bottom: none; border-radius: 0;">Received Requests</button>
            </div>

            <div id="adoption-content">
                <div class="flex-center" style="min-height: 200px;">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    // Default to sent tab
    switchAdoptionTab('sent');
}

async function switchAdoptionTab(tab) {
    const contentDiv = document.getElementById('adoption-content');
    const sentBtn = document.getElementById('tab-sent');
    const receivedBtn = document.getElementById('tab-received');

    // Update button styles
    if (tab === 'sent') {
        sentBtn.classList.add('btn-primary');
        sentBtn.classList.remove('btn-outline');
        receivedBtn.classList.add('btn-outline');
        receivedBtn.classList.remove('btn-primary');
    } else {
        receivedBtn.classList.add('btn-primary');
        receivedBtn.classList.remove('btn-outline');
        sentBtn.classList.add('btn-outline');
        sentBtn.classList.remove('btn-primary');
    }

    contentDiv.innerHTML = '<div class="flex-center" style="min-height: 200px;"><div class="spinner"></div></div>';

    try {
        if (tab === 'sent') {
            const requests = await API.getMyAdoptionRequests();
            renderSentRequests(requests, contentDiv);
        } else {            const requests = await API.getReceivedAdoptionRequests();
            renderReceivedRequests(requests, contentDiv);
        }
    } catch (error) {
        contentDiv.innerHTML = '<p>Failed to load adoption requests.</p>';
    }
}

function renderSentRequests(requests, container) {
    if (requests.length === 0) {
        container.innerHTML = '<p class="text-muted">You haven\'t sent any adoption requests yet.</p>';
        return;
    }

    container.innerHTML = requests.map(req => `
        <div class="card mb-md">
            <div class="flex-between">
                <h4>Request for: ${req.pet_name}</h4>
                <span class="status-pill status-${req.status}">${req.status}</span>
            </div>
            <p class="text-muted">Date: ${window.utils.formatDate(req.created_at)}</p>
            <p>${req.message || 'No message provided.'}</p>
            
            <div class="flex gap-md mt-md">
                ${req.status === 'pending' ? `<button onclick="cancelRequest(${req.id})" class="btn btn-sm btn-danger">Cancel Request</button>` : ''}
                
                ${req.status === 'approved' ? `
                    <button onclick="viewAgreement(${req.id})" class="btn btn-sm btn-secondary">View Agreement</button>
                    ${req.payment_required ? `<a href="/#payment/${req.id}" class="btn btn-sm btn-primary">Proceed to Payment</a>` : ''}
                ` : ''}
            </div>
        </div>
    `).join('');
}

function renderReceivedRequests(requests, container) {
    if (requests.length === 0) {
        container.innerHTML = '<p class="text-muted">You haven\'t received any adoption requests yet.</p>';
        return;
    }

    container.innerHTML = requests.map(req => `
        <div class="card mb-md">
            <div class="flex-between">
                <h4>From: ${req.requester_name}</h4>
                <span class="status-pill status-${req.status}">${req.status}</span>
            </div>
            <p><strong>Phone:</strong> ${req.requester_phone}</p>
            <p><strong>Date:</strong> ${window.utils.formatDate(req.created_at)}</p>
            <p>${req.message || 'No message provided.'}</p>            
            ${req.status === 'pending' ? `
                <div class="flex gap-md mt-md">
                    <button onclick="updateRequestStatus(${req.id}, 'approved')" class="btn btn-sm btn-primary">Approve</button>
                    <button onclick="updateRequestStatus(${req.id}, 'rejected')" class="btn btn-sm btn-danger">Reject</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function cancelRequest(id) {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    try {
        await API.cancelAdoptionRequest(id);
        window.utils.showToast('Request cancelled', 'success');
        switchAdoptionTab('sent');
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to cancel', 'error');
    }
}

async function updateRequestStatus(id, status) {
    const reason = status === 'rejected' ? prompt('Please provide a reason for rejection:') : '';
    if (status === 'rejected' && !reason) return;

    try {
        await API.updateAdoptionRequest(id, { status, reason });
        window.utils.showToast(`Request ${status}`, 'success');
        switchAdoptionTab('received');
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to update', 'error');
    }
}

async function viewAgreement(id) {
    window.utils.showLoading();
    try {
        const agreement = await API.getAgreement(id);
        window.utils.hideLoading();
        
        const content = `
            <h3>Adoption Agreement</h3>
            <p><strong>Pet:</strong> ${agreement.pet_name}</p>
            <p><strong>Owner Agreed:</strong> ${agreement.owner_agreed ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Adopter Agreed:</strong> ${agreement.adopter_agreed ? '✅ Yes' : '❌ No'}</p>
            <hr class="mt-md mb-md">
            <p class="text-muted">By signing, you agree to provide a safe and loving home for this pet.</p>
            
            ${!agreement.bothAgreed ? `                <button onclick="signAgreement(${id})" class="btn btn-primary mt-md" style="width: 100%;">Sign Agreement</button>
            ` : `
                <div class="status-pill status-good mt-md" style="width: 100%; text-align: center;">Adoption Finalised! 🎉</div>
            `}
        `;
        
        window.utils.showModal(content, 'Agreement Details');
        
        // Inside viewAgreement or a new "View Details" function for approved requests:
        const followupHTML = `
            <div class="mt-lg pt-lg" style="border-top: 1px solid var(--border-color);">
                <h3>Pet Follow-ups</h3>
                <div id="followups-container"></div>
            </div>
        `;
        // Append this to the modal or detail view
        document.querySelector('.modal').innerHTML += followupHTML;
        renderFollowups(id);
        
    } catch (error) {
        window.utils.hideLoading();
        window.utils.showToast('Failed to load agreement', 'error');
    }
}

async function signAgreement(id) {
    try {
        await API.signAgreement(id);
        window.utils.showToast('Agreement signed!', 'success');
        closeModal();
        // Refresh the tab to show updated status
        setTimeout(() => switchAdoptionTab('sent'), 1000);
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to sign', 'error');
    }
}