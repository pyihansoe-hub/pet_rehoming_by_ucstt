// js/pages/payment.js - Payment Flow Logic

async function renderPayment(adoptionRequestId) {
    const mainContent = document.getElementById('main-content');
    
    // Check if we are returning from Aya Pay with a payment ID
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('payment_id');

    if (paymentId) {
        // Verify payment
        mainContent.innerHTML = `
            <div class="container mt-lg flex-center" style="flex-direction: column;">
                <div class="spinner mb-md"></div>
                <p>Verifying your payment...</p>
            </div>
        `;
        
        try {
            await API.verifyPayment(paymentId);
            mainContent.innerHTML = `
                <div class="container mt-lg flex-center" style="flex-direction: column; text-align: center;">
                    <h2 style="color: var(--status-green);">Payment Successful! 🎉</h2>
                    <p>Your adoption request has been fully processed.</p>
                    <a href="/#adoptions" class="btn btn-primary mt-lg">View My Adoptions</a>
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `
                <div class="container mt-lg flex-center" style="flex-direction: column; text-align: center;">
                    <h2 style="color: var(--status-red);">Payment Verification Failed</h2>
                    <p>${error.message}</p>
                    <a href="/#adoptions" class="btn btn-outline mt-lg">Back to Adoptions</a>
                </div>
            `;
        }
        return;
    }

    // Initial payment initiation
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <h2>Complete Payment</h2>
                <p>Please confirm the details before proceeding to Aya Pay.</p>
                
                <div id="payment-details" class="mt-lg">
                    <div class="flex-center"><div class="spinner"></div></div>
                </div>
            </div>        </div>
    `;

    try {
        // We need to get the adoption request details to know the amount
        // Note: In a real app, you might pass the amount directly or fetch it via a specific endpoint
        // For now, let's assume we fetch the request to get the pet fee
        const requests = await API.getMyAdoptionRequests();
        const req = requests.find(r => r.id == adoptionRequestId);
        
        if (!req) throw new Error('Adoption request not found');

        const amount = req.adoption_fee || 0;
        
        document.getElementById('payment-details').innerHTML = `
            <div class="form-group">
                <label class="form-label">Pet Name</label>
                <input type="text" class="form-input" value="${req.pet_name}" disabled>
            </div>
            <div class="form-group">
                <label class="form-label">Amount (MMK)</label>
                <input type="text" class="form-input" value="${amount}" disabled>
            </div>
            <button onclick="initiatePayment(${adoptionRequestId}, ${amount})" class="btn btn-primary btn-lg" style="width: 100%;">
                Pay with Aya Pay
            </button>
        `;

    } catch (error) {
        document.getElementById('payment-details').innerHTML = `<p class="text-muted">Error loading payment details.</p>`;
    }
}

async function initiatePayment(adoptionRequestId, amount) {
    window.utils.showLoading();
    try {
        const result = await API.initiatePayment({
            amount: amount,
            currency: 'MMK',
            description: `Adoption fee for request #${adoptionRequestId}`,
            adoption_request_id: adoptionRequestId
        });
        
        // Redirect to Aya Pay
        if (result.paymentUrl) {
            window.location.hash = result.paymentUrl;
        } else {
            throw new Error('No payment URL received');
        }
    } catch (error) {        window.utils.hideLoading();
        window.utils.showToast(error.message || 'Failed to initiate payment', 'error');
    }
}