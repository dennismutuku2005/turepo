const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to check for input field and form
async function checkAndSubmitForm(page) {
    const hasInputAndForm = await page.evaluate(() => {
        const inputField = document.querySelector('input[name="human"]');
        const form = document.querySelector('.form-vertical');

        if (inputField && form) {
            form.style.display = 'none';
            inputField.value = 'r';
            form.submit();
            return true;
        }
        return false;
    });

    if (hasInputAndForm) {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    }
}

// Route to handle student portal login and data extraction
app.post('/studentportal', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    let browser;
    try {
        // Start Puppeteer
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();

        // Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Navigate to the login page
        await page.goto('https://portal.tukenya.ac.ke/?r=site/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Step 1: Check for the presence of an input field and form (before login)
        await checkAndSubmitForm(page);

        // Step 2: Fill in the login form
        await page.type('input[name="LoginForm[username]"]', username, { delay: 0 });
        await page.type('input[name="LoginForm[password]"]', password, { delay: 0 });

        // Step 3: Submit the login form
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            page.click('.btn.btn-success.btn-large'),
        ]);

        // Step 4: Check for login error message
        const loginError = await page.evaluate(() => {
            const errorElement = document.querySelector('.help-inline.error');
            return errorElement ? errorElement.innerText.trim() : null;
        });

        if (loginError) {
            await browser.close();
            return res.status(401).json({ error: 'Login failed', message: loginError });
        }

        // Step 5: Check for the presence of an input field and form (after login)
        await checkAndSubmitForm(page);

        // Step 6: Extract all <h1> elements from the final page
        const h1Elements = await page.evaluate(() => {
            const h1s = Array.from(document.querySelectorAll('h1'));
            return h1s.map(h1 => h1.innerText.trim());
        });

        // Step 7: Extract additional data (student info, fees, classmates, etc.)
        const studentData = await page.evaluate(() => {
            const findTableCellByLabel = (label) => {
                const rows = Array.from(document.querySelectorAll('tr'));
                for (const row of rows) {
                    const header = row.querySelector('th')?.innerText.trim();
                    if (header === label) {
                        return row.querySelector('td')?.innerText.trim();
                    }
                }
                return null;
            };

            const findClassmates = () => {
                const rows = Array.from(document.querySelectorAll('tr'));
                const classmates = {};
                for (const row of rows) {
                    const cols = row.querySelectorAll('td');
                    if (cols.length === 2) {
                        const index = cols[0]?.innerText.trim();
                        const name = cols[1]?.innerText.trim();
                        if (/^\d+$/.test(index)) {
                            classmates[index] = name;
                        }
                    }
                }
                return classmates;
            };

            const name = document.querySelector('h1').innerText.trim();
            const regNumber = findTableCellByLabel('Reg Number');
            const programme = findTableCellByLabel('Programme');
            const yearOfStudy = findTableCellByLabel('Year Of Study');
            const cumulativeFees = document.querySelector('td.navy')?.innerText.trim();
            const paymentsReceived = document.querySelector('td.teal')?.innerText.trim();
            const closingBalance = document.querySelector('td.read')?.innerText.trim();
            const classmates = findClassmates();
            const emailRow = Array.from(document.querySelectorAll('tr')).find((row) =>
                row.innerText.includes('Official Email')
            );
            const email = emailRow ? emailRow.querySelector('span.read')?.innerText.trim() : null;
            const elearningLink = document.querySelector('a[href*="elearning.tukenya.ac.ke"]')?.href;

            const notices = [];
            const noticeTable = document.querySelector('table.table-bordered.table-stripped');
            if (noticeTable) {
                const rows = noticeTable.querySelectorAll('tr');
                rows.forEach((row) => {
                    const cols = row.querySelectorAll('td');
                    if (cols.length === 2) {
                        const notice = cols[0].innerText.trim();
                        const status = cols[1].innerText.replace(/»View more/g, '').trim();
                        notices.push({ notice, status });
                    }
                });
            }

            return {
                studentInfo: { name, regNumber, programme, yearOfStudy },
                feesInfo: { cumulativeFees, paymentsReceived, closingBalance },
                classmates,
                eLearningInfo: { email, elearningLink },
                notices,
            };
        });

        // Close the browser
        await browser.close();

        // Send the extracted data as a JSON response
        res.status(200).json({
            h1Elements,
            studentData,
        });
    } catch (error) {
        console.error('Error:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});