/**
 * Aya Pay service
 * Fill in endpoint paths + request shape once you have their API docs / credentials.
 */

const BASE_URL  = process.env.AYAPAY_BASE_URL   || 'https://api.ayapay.com';
const API_KEY   = process.env.AYAPAY_API_KEY;
const MERCHANT  = process.env.AYAPAY_MERCHANT_ID;

const initiatePayment = async ({ amount, currency = 'MMK', description, orderId }) => {
  const res = await fetch(`${BASE_URL}/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ merchantId: MERCHANT, amount, currency, description, orderId }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `AyaPay ${res.status}`); }
  const data = await res.json();
  return { reference: data.transactionId || data.reference, paymentUrl: data.paymentUrl, rawResponse: data };
};

const verifyPayment = async (reference) => {
  const res = await fetch(`${BASE_URL}/payments/${reference}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `AyaPay ${res.status}`); }
  const data = await res.json();
  const map = { SUCCESS: 'completed', FAILED: 'failed', PENDING: 'pending', REFUNDED: 'refunded' };
  return { status: map[data.status] || 'pending', rawResponse: data };
};

module.exports = { initiatePayment, verifyPayment };
