// --- Upload Page Logic ---
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('nit_file');

if (fileInput) {
    // Show selected filename
    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            document.getElementById('fileNameDisplay').textContent = e.target.files[0].name;
        }
    });
}

if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) return alert("Please select a PDF file.");

        const formData = new FormData();
        formData.append('nit_file', file);

        const btn = document.getElementById('submitBtn');
        const loader = document.getElementById('uploadLoader');
        const resultBox = document.getElementById('resultBox');

        btn.disabled = true;
        loader.style.display = 'block';
        resultBox.style.display = 'none';

        try {
            // Call your Express backend
            const response = await fetch('http://localhost:3000/api/v1/tenders/parse-nit', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // Populate the success UI
                document.getElementById('refDisplay').textContent = data.benchmark.tender_reference;
                document.getElementById('costDisplay').textContent = data.benchmark.estimated_cost_rupees.toLocaleString();
                resultBox.style.display = 'block';
            } else {
                alert("Error parsing NIT: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Connection error. Is your Express server running?");
        } finally {
            btn.disabled = false;
            loader.style.display = 'none';
        }
    });
}

// --- Leaderboard Page Logic ---
// --- Leaderboard Page Logic ---
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchReference');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', async () => {
            const reference = searchInput.value.trim();
            if (!reference) return alert("Enter a reference number");

            const searchButton = document.getElementById('searchBtn');
            searchButton.textContent = "Fetching...";
            searchButton.disabled = true;

            try {
                // 1. Fetch the Tender Benchmark rules
                const response = await fetch(`http://localhost:3000/api/v1/tenders/lookup?reference=${encodeURIComponent(reference)}`);
                const data = await response.json();

                if (!data.success) {
                    alert("Tender not found in database.");
                    searchButton.textContent = "Fetch Data";
                    searchButton.disabled = false;
                    return;
                }

                // Parse and render the benchmark UI
                const benchmark = typeof data.tender.nit_benchmark === 'string' 
                    ? JSON.parse(data.tender.nit_benchmark) 
                    : data.tender.nit_benchmark;

                document.getElementById('dashEmd').textContent = benchmark.emd_amount_rupees.toLocaleString();
                document.getElementById('dashTurnover').textContent = benchmark.mandatory_requirements.minimum_average_turnover_rupees.toLocaleString();
                document.getElementById('dashCharge').textContent = benchmark.financial_rules.minimum_service_charge_percent;
                document.getElementById('dashboardData').style.display = 'block';

                // 2. Fetch the Live Bids for this tender
                const bidsContainer = document.getElementById('bidsContainer');
                bidsContainer.innerHTML = '<p style="color: var(--text-muted);">Fetching live bids...</p>';

const bidsResponse = await fetch(`http://localhost:3000/api/v1/bids/list?reference=${encodeURIComponent(reference)}`);
                const bidsData = await bidsResponse.json();

                if (bidsData.success && bidsData.bids.length > 0) {
                    bidsContainer.innerHTML = ''; // Clear the loading text
                    
                    // Loop through the bids and generate HTML for each
                    bidsData.bids.forEach(bid => {
                        // Extract evaluation status safely
                        const evalData = typeof bid.evaluation === 'string' ? JSON.parse(bid.evaluation) : bid.evaluation;
                        const vendorName = bid.vendor_name || evalData?.compliance?.vendor_name || "Unknown Vendor";
                        
                        // Check if the overall status includes the word "QUALIFIED"
                        const isPass = evalData?.overall_status?.includes('QUALIFIED');
                        const badgeClass = isPass ? 'badge pass' : 'badge fail';
                        const statusText = isPass ? 'QUALIFIED' : 'DISQUALIFIED';

                        // Prepare rank display (if available)
                        const displayRank = bid.display_rank || evalData?.ranking?.placement || null;

                        // Inject the bid card into the DOM
                        bidsContainer.innerHTML += `
                            <div style="margin-top: 1rem; padding: 1rem; border: 1px solid var(--border); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background: #fff;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="width:44px;height:44px;border-radius:999px;background:#0ea5a4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;">
                                        ${displayRank ? displayRank : '-'}
                                    </div>
                                    <div>
                                        <strong style="font-size: 1.1rem;">${vendorName}</strong>
                                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                                            Service Charge Quoted: ${evalData?.financial?.quoted_service_charge_percent || 'N/A'}%
                                        </p>
                                    </div>
                                </div>
                                <span class="${badgeClass}">${statusText}</span>
                            </div>
                        `;
                    });
                } else {
                    bidsContainer.innerHTML = '<p style="color: var(--text-muted);">No bids submitted yet. Waiting for emails...</p>';
                }

            } catch (error) {
                console.error("Fetch Error:", error);
                alert("Connection error while fetching data.");
            } finally {
                searchButton.textContent = "Fetch Data";
                searchButton.disabled = false;
            }
        });
    }