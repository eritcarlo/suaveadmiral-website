// Global variables for rescheduling
let currentBookingId = null;
let selectedBarber = null;
let selectedDate = null;
let selectedTime = null;

// Function to load available barbers
async function loadBarbers() {
    try {
        const response = await fetch('/api/barbers?present_only=true');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success || !data.barbers) {
            throw new Error(data.error || 'Failed to load barbers');
        }

        const barberSelect = document.getElementById('reschedule-barber');
        if (!barberSelect) {
            throw new Error('Barber select element not found');
        }

        barberSelect.innerHTML = '<option value="">Choose a barber</option>' +
            data.barbers.map(barber => 
                `<option value="${barber.id}">${barber.name}</option>`
            ).join('');

        return data.barbers;
    } catch (error) {
        console.error('Error loading barbers:', error);
        throw new Error('Failed to load barbers: ' + error.message);
    }
}

// Function to load available times
async function loadAvailableTimes() {
    const timeSelect = document.getElementById('reschedule-time');
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="">Loading times...</option>';

    if (!selectedBarber || !selectedDate) {
        timeSelect.innerHTML = '<option value="">Select date and barber first</option>';
        return;
    }

    try {
        const response = await fetch(`/api/available-times/${selectedBarber}/${selectedDate}`);
        const data = await response.json();
        if (data.success) {
            timeSelect.disabled = false;
            if (data.times.length === 0) {
                timeSelect.innerHTML = '<option value="">No available times</option>';
            } else {
                timeSelect.innerHTML = '<option value="">Choose a time</option>' +
                    data.times.map(time => 
                        `<option value="${time.id}">${time.time}</option>`
                    ).join('');
            }
        }
    } catch (error) {
        console.error('Error loading times:', error);
        timeSelect.innerHTML = '<option value="">Error loading times</option>';
    }
}

// Function to setup the reschedule modal
function setupRescheduleModal() {
    const modal = document.getElementById('reschedule-modal');
    const closeBtn = document.querySelector('.close-reschedule');
    const cancelBtn = document.getElementById('cancel-reschedule');
    const confirmBtn = document.getElementById('confirm-reschedule');
    const barberSelect = document.getElementById('reschedule-barber');
    const dateInput = document.getElementById('reschedule-date');
    const timeSelect = document.getElementById('reschedule-time');

    // Set minimum date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];

    // Event Listeners
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    barberSelect.addEventListener('change', (e) => {
        selectedBarber = e.target.value;
        loadAvailableTimes();
    });

    dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        loadAvailableTimes();
    });

    timeSelect.addEventListener('change', (e) => {
        selectedTime = e.target.value;
    });

    confirmBtn.addEventListener('click', async () => {
        if (!selectedBarber || !selectedDate || !selectedTime) {
            showModal('Please fill in all fields');
            return;
        }

        const loadingDiv = document.querySelector('.reschedule-loading');
        loadingDiv.style.display = 'flex';

        try {
            const response = await fetch('/api/reschedule-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bookingId: currentBookingId,
                    barberId: selectedBarber,
                    timeId: selectedTime,
                    bookingDate: selectedDate
                })
            });

            const data = await response.json();
            loadingDiv.style.display = 'none';

            if (data.success) {
                modal.style.display = 'none';
                showModal('Booking rescheduled successfully! Please wait for admin confirmation.');
                // Refresh bookings display
                await new Promise(resolve => setTimeout(resolve, 500));
                if (typeof loadBookings === 'function') {
                    loadBookings();
                } else {
                    location.reload();
                }
            } else {
                showModal(data.error || 'Failed to reschedule booking');
            }
        } catch (error) {
            loadingDiv.style.display = 'none';
            showModal('An error occurred. Please try again.');
        }
    });
}

// Function to open the reschedule modal
async function openRescheduleModal(bookingId) {
    const loadingDiv = document.querySelector('.reschedule-loading');
    const modal = document.getElementById('reschedule-modal');
    
    try {
        currentBookingId = bookingId;
        selectedBarber = null;
        selectedDate = null;
        selectedTime = null;

        // Reset form first
        const barberSelect = document.getElementById('reschedule-barber');
        const dateInput = document.getElementById('reschedule-date');
        const timeSelect = document.getElementById('reschedule-time');

        if (!barberSelect || !dateInput || !timeSelect || !loadingDiv || !modal) {
            throw new Error('Required elements not found');
        }

        // Reset form fields before showing modal
        barberSelect.value = '';
        dateInput.value = '';
        timeSelect.innerHTML = '<option value="">Select date and barber first</option>';
        timeSelect.disabled = true;

        // Show modal first, then loading state
        modal.style.display = 'block';
        loadingDiv.style.display = 'flex';

        // Load barbers
        const barbers = await loadBarbers();
        
        if (!barbers || barbers.length === 0) {
            throw new Error('No barbers available');
        }

        // Hide loading after successful load
        loadingDiv.style.display = 'none';

    } catch (error) {
        console.error('Error in openRescheduleModal:', error);
        // Always hide loading state
        if (loadingDiv) loadingDiv.style.display = 'none';
        // Hide modal
        if (modal) modal.style.display = 'none';
        // Show error message
        showModal('Error: ' + (error.message || 'Could not load reschedule options. Please try again.'));
    }
}

// Function to reload bookings
async function loadBookings() {
    const container = document.getElementById("bookings-container");
    const loading = document.getElementById("loading-screen");
    if (!container || !loading) return;

    loading.style.display = "flex";

    try {
        const res = await fetch("/api/my-bookings");
        const data = await res.json();
        loading.style.display = "none";

        if (!data.success || !data.bookings || data.bookings.length === 0) {
            container.innerHTML = "<p>No bookings found.</p>";
            return;
        }

        // Clear existing bookings
        container.innerHTML = '';
        
        data.bookings.forEach(booking => {
            let statusText = "Pending";
            if (booking.payment_method) {
                const method = booking.payment_method.toLowerCase();
                if (method === "gcash" || method === "paymaya") {
                    statusText = "Paid";
                }
            }
            const paymentClass = getPaymentClass(booking.payment_method);
            const statusClass = getStatusClass(statusText);
            const paymentText = booking.payment_method ? booking.payment_method : "Not paid";
            const appointmentDate = booking.booking_date || 'Not specified';
            
            const div = document.createElement("div");
            div.classList.add("booking-card");
            div.innerHTML = `
                <h3><i class="fa-solid fa-scissors"></i> ${booking.service}</h3>
                <p><strong>Barber:</strong> ${booking.barber}</p>
                <p><strong>Time:</strong> ${booking.time}</p>
                <p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
                <p><strong>Payment Method:</strong> <span class="${paymentClass}">${paymentText}</span></p>
                <p><strong>Date Booked:</strong> ${appointmentDate}</p>
                <div class="booking-actions">
                    <button class="cancel-btn" data-id="${booking.id}">Cancel Booking</button>
                    <button class="reschedule-btn" data-id="${booking.id}"><i class="fas fa-calendar-alt"></i> Reschedule</button>
                </div>
            `;
            container.appendChild(div);
        });

        // Add event listeners for cancel and reschedule buttons
        document.querySelectorAll('.reschedule-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const bookingId = this.getAttribute('data-id');
                await openRescheduleModal(bookingId);
            });
        });

        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const confirmed = await showConfirmModal("Are you sure you want to cancel this booking?");
                if (!confirmed) return;
                
                const bookingId = this.getAttribute('data-id');
                try {
                    const res = await fetch('/api/cancel-booking', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId })
                    });
                    const result = await res.json();
                    if (result.success) {
                        showModal("Booking cancelled successfully! You can now make new bookings.");
                        // Reload bookings
                        loadBookings();
                    } else {
                        showModal(result.error || "Failed to cancel booking.");
                    }
                } catch (error) {
                    showModal("Error cancelling booking. Please try again.");
                }
            });
        });
    } catch (err) {
        loading.style.display = "none";
        container.innerHTML = "<p>Error loading bookings.</p>";
        showModal("Error loading bookings. Please refresh the page.");
    }
}

// Helper functions for payment and status classes
function getPaymentClass(method) {
    if (!method) return "payment-notpaid";
    method = method.toLowerCase();
    if (method === "cash") return "payment-cash";
    if (method === "gcash") return "payment-gcash";
    if (method === "paymaya") return "payment-paymaya";
    return "payment-notpaid";
}

function getStatusClass(statusText) {
    return statusText === "Paid" ? "status-paid" : "status-pending";
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    setupRescheduleModal();
});