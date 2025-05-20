// Base URLs for the APIs
// noinspection JSNonASCIINames,NonAsciiCharacters

const RAAMATUD_API_URL = "https://raamatud-api-ebegaqarewcvg7hm.northeurope-01.azurewebsites.net/raamatud/";
const OTSING_API_URL = "https://otsing-api-c9gkh2adanama0g5.northeurope-01.azurewebsites.net/raamatu_otsing/";

// Helper function to display messages/results
function näitaTulemust(message, isError = false) {
    const tulemusDiv = document.getElementById("tulemus");
    // Use innerHTML to allow basic formatting like line breaks
    tulemusDiv.innerHTML = message.replace(/\n/g, '<br>');
    tulemusDiv.style.color = isError ? 'red' : 'black';
}

// Helper function to clear the results area
function puhastaTulemus() {
     const tulemusDiv = document.getElementById("tulemus");
     tulemusDiv.textContent = '';
}

// Posts a plain JavaScript object as JSON
async function postJsonData({ url, data }) {
    const jsonDataString = JSON.stringify(data);

    const fetchOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: jsonDataString,
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorMessage = await response.text();
        let detail = errorMessage;
        try {
            const errorJson = JSON.parse(errorMessage);
            detail = errorJson.tulemus || errorJson.error || errorMessage;
        } catch(e) { /* Ignore if not JSON */ }
        throw new Error(`HTTP error ${response.status}: ${detail}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return { success: true, status: response.status, text: await response.text() };
    }
}


// Keep this function if other forms might use FormData in the future,
// otherwise it could be removed if postJsonData covers all POST needs.
async function postFormDataAsJson({ url, formData }) {
    const plainFormData = Object.fromEntries(formData.entries());
    // Now we can reuse postJsonData
    return postJsonData({ url: url, data: plainFormData });
}

async function getDataAsJson(url) {
    const fetchOptions = {
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    };
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorMessage}`);
    }
    return response.json();
}

// Fetches text data (like book content)
async function getTextData(url) {
	const fetchOptions = {
		method: "GET",
		headers: {
			"Accept": "text/plain" // Expecting plain text
		}
	};
	const response = await fetch(url, fetchOptions);

	if (!response.ok) {
		const errorMessage = await response.text();
		throw new Error(`HTTP error ${response.status}: ${errorMessage}`);
	}
	return response.text(); // Return the response body as text
}


async function deleteObject(url) {
    const fetchOptions = {
        method: "DELETE"
    };
    const response = await fetch(url, fetchOptions);

    if (!response.ok) { // Check for 204 No Content as well? Usually ok means 200-299
        const errorMessage = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorMessage}`);
    }
     // No return needed for successful delete, or maybe return true
    return true;
}


async function handleFormSubmit(event) {
    event.preventDefault();
    puhastaTulemus(); // Clear previous results

    const form = event.currentTarget;
    const url = form.action;
    const formId = form.id; // Get the ID of the form

    try {
        const formData = new FormData(form);

        // We only expect the 'frontform' (add book form) here now
        if (formId === "frontform") {
             // Using postFormDataAsJson which now internally uses postJsonData
            const responseData = await postFormDataAsJson({ url, formData });
            console.log({ responseData }); // Log for debugging
            näitaTulemust(`Lisamine: ${responseData.tulemus || 'Edukalt lisatud.'} (ID: ${responseData.raamatu_id || formData.get('raamatu_id')})`);
            form.reset(); // Clear the form fields
            listiraamatud(); // Refresh the book list
        } else {
             console.warn("Unhandled form submission for form ID:", formId);
        }

    } catch (error) {
        console.error(error);
        näitaTulemust(`Viga: ${error.message}`, true);
    }
}

async function listiraamatud() {
    const resultDiv = document.getElementById("raamatud_result");
    resultDiv.innerHTML = 'Laen nimekirja...'; // Show loading indicator

    try {
        const data = await getDataAsJson(RAAMATUD_API_URL);
        resultDiv.innerHTML = ''; // Clear loading indicator

        if (data.raamatud && data.raamatud.length > 0) {
            const ul = document.createElement('ul');
            data.raamatud.forEach(bookId => {
                const li = document.createElement('li');
                li.style.marginBottom = '10px'; // Add some space between items

                // Book ID and basic actions
                const infoSpan = document.createElement('span');
                infoSpan.textContent = `ID: ${bookId} `;
                li.appendChild(infoSpan);

                const viewButton = document.createElement('button');
                viewButton.textContent = 'Vaata sisu';
                viewButton.onclick = () => vaataraamatut(bookId);
                viewButton.style.marginLeft = '5px';
                li.appendChild(viewButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Kustuta';
                deleteButton.style.marginLeft = '5px';
                deleteButton.onclick = () => kustutaraamat(bookId);
                li.appendChild(deleteButton);

                // Search within this book elements
                const searchInput = document.createElement('input');
                searchInput.type = 'text';
                searchInput.placeholder = 'Otsi siit raamatust...';
                searchInput.id = `otsi_sone_${bookId}`; // Unique ID for the input
                searchInput.style.marginLeft = '10px';
                li.appendChild(searchInput);

                const searchButton = document.createElement('button');
                searchButton.textContent = 'Otsi';
                searchButton.style.marginLeft = '5px';
                searchButton.onclick = () => otsiraamatust(bookId); // Pass bookId to the search function
                li.appendChild(searchButton);


                ul.appendChild(li);
            });
            resultDiv.appendChild(ul);
        } else {
            resultDiv.textContent = 'Ühtegi raamatut ei leitud.';
        }
    } catch (error) {
        console.error('Raamatute laadimise viga:', error);
        resultDiv.innerHTML = `<span style="color: red;">Raamatute nimekirja laadimine ebaõnnestus: ${error.message}</span>`;
    }
}

// Function to view book content
async function vaataraamatut(bookId) {
    puhastaTulemus();
    näitaTulemust(`Laen raamatu ${bookId} sisu...`);
    try {
        const bookContent = await getTextData(`${RAAMATUD_API_URL}${bookId}`);
        const preview = bookContent.substring(0, 1000);
        näitaTulemust(`Raamatu ${bookId} sisu (algus):\n\n${preview}${bookContent.length > 1000 ? '...' : ''}`);
        console.log(`Raamatu ${bookId} täis sisu:`, bookContent);
    } catch (error) {
        console.error(`Viga raamatu ${bookId} sisu laadimisel:`, error);
        näitaTulemust(`Viga raamatu ${bookId} sisu laadimisel: ${error.message}`, true);
    }
}

// Function to delete a book
async function kustutaraamat(bookId) {
     if (!confirm(`Kas oled kindel, et soovid kustutada raamatu ID ${bookId}?`)) {
        return; // Stop if user cancels
    }
    puhastaTulemus();
    näitaTulemust(`Kustutan raamatut ${bookId}...`);
    try {
        await deleteObject(`${RAAMATUD_API_URL}${bookId}`);
        näitaTulemust(`Raamat ${bookId} edukalt kustutatud.`);
        listiraamatud(); // Refresh the list after deletion
    } catch (error) {
        console.error(`Viga raamatu ${bookId} kustutamisel:`, error);
        näitaTulemust(`Viga raamatu ${bookId} kustutamisel: ${error.message}`, true);
    }
}

// Function to search within a specific book
async function otsiraamatust(bookId) {
    puhastaTulemus();
    const searchInput = document.getElementById(`otsi_sone_${bookId}`);
    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
        näitaTulemust("Palun sisesta otsingusõna.", true);
        return;
    }

    näitaTulemust(`Otsin sõna "${searchTerm}" raamatust ${bookId}...`);
    const url = `${OTSING_API_URL}${bookId}`; // Specific book search URL
    const data = { "sone": searchTerm }; // Payload

    try {
        const responseData = await postJsonData({ url, data });
        console.log("Specific search response:", responseData);
        // The API returns {"raamatu_id": id, "sone": term, "leitud": count}
        näitaTulemust(`Raamatus ${bookId} leiti sõna "${responseData.sone}" ${responseData.leitud} korda.`);

    } catch (error) {
        console.error(`Viga otsimisel raamatust ${bookId}:`, error);
        näitaTulemust(`Viga otsimisel raamatust ${bookId}: ${error.message}`, true);
    }
}

// Function to search across all books
async function otsiKoikidest() {
    puhastaTulemus();
    const searchInput = document.getElementById(`global_sone`);
    const searchTerm = searchInput.value.trim();

     if (!searchTerm) {
        näitaTulemust("Palun sisesta otsingusõna.", true);
        return;
    }

    näitaTulemust(`Otsin sõna "${searchTerm}" kõikidest raamatutest...`);
    const url = OTSING_API_URL; // Base search URL for all books
    const data = { "sone": searchTerm }; // Payload

    try {
        const responseData = await postJsonData({ url, data });
        console.log("Global search response:", responseData);
        // The API returns {"sone": term, "tulemused": [{"raamatu_id": id, "leitud": count}, ...]}

        if (responseData.tulemused && responseData.tulemused.length > 0) {
             let resultText = `Otsingutulemused sõnale "${responseData.sone}":\n`;
             responseData.tulemused.forEach(tulemus => {
                resultText += ` - Raamatus ${tulemus.raamatu_id}: ${tulemus.leitud} vastet\n`;
             });
             näitaTulemust(resultText);
         } else {
            näitaTulemust(`Sõna "${responseData.sone}" ei leitud ühestki raamatust.`);
         }

    } catch (error) {
        console.error(`Viga otsimisel kõikidest raamatutest:`, error);
        näitaTulemust(`Viga otsimisel kõikidest raamatutest: ${error.message}`, true);
    }

}