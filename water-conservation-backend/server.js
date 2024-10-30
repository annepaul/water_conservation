const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('MySQL connected...');
});

// API Endpoints
// User Registration
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    const sql = 'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)';
    db.query(sql, [username, email, password], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Registration failed' });
        }
        res.status(201).json({ message: 'User registered successfully' });
    });
});

// User Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM Users WHERE username = ?';
    
    db.query(sql, [username], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = results[0];
        
        // For simplicity, we directly compare passwords. In production, use bcrypt to hash and compare passwords.
        if (user.password !== password) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        
        res.status(200).json({ message: 'Login successful' , user_id: user.user_id});
    });
});

// Log Water Usage
app.post('/api/log-water-usage', (req, res) => {
    const { user_id, task, water_amount, date } = req.body;
    console.log('Received data:', { user_id, task, water_amount, date });

    // Step 1: Fetch the standard_amount for the given task
    const getStandardSql = 'SELECT standard_amount FROM task_standards WHERE task_name = ?';
    db.query(getStandardSql, [task], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch standard amount' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Task not found in standards' });
        }

        const standardAmount = parseFloat(results[0].standard_amount);

        // Step 2: Compare water_amount with standard_amount to determine feedback and points
        let usage_feedback;
        let points = 0;
        const difference = standardAmount - parseFloat(water_amount);

        if (parseFloat(water_amount) < standardAmount) {
            usage_feedback = 'You are Conserving Water';
            points = 10 + (2 * Math.abs(difference));
        } else if (parseFloat(water_amount) === standardAmount) {
            usage_feedback = 'Normal Usage, You are doing OKAY';
            points = 10;
        } else {
            usage_feedback = 'Excessive!! Save water PLEASEE';
            points = 10 - (2 * (parseFloat(water_amount) - standardAmount));
        }

        // Step 3: Insert the water usage data into Water_Usage table
        const insertUsageSql = 'INSERT INTO Water_Usage (user_id, task, water_amount, date) VALUES (?, ?, ?, ?)';
        db.query(insertUsageSql, [user_id, task, water_amount, date], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to log water usage' });
            }

            // Step 4: Insert the reward into Rewards table (logging both positive and negative points)
            const rewardDate = new Date(); // Current date for reward_date
            const insertRewardSql = 'INSERT INTO Rewards (user_id, points, reward_date) VALUES (?, ?, ?)';
            db.query(insertRewardSql, [user_id, points, rewardDate], (err, rewardResult) => {
                if (err) {
                    console.error('Database error while inserting reward:', err);
                    return res.status(500).json({ error: 'Failed to log reward' });
                }

                // Step 5: Return feedback to the user
                res.status(201).json({ message: 'Water usage logged successfully', usage_feedback, standardAmount, points });
            });
        });
    });
});



// Fetch Total Reward Points
app.post('/api/get-total-rewards', (req, res) => {
    const { user_id } = req.body; // Get user_id from the request body

    // SQL query to sum the points for the current user
    const getTotalPointsSql = 'SELECT SUM(points) AS total_points FROM Rewards WHERE user_id = ?';
    db.query(getTotalPointsSql, [user_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch total reward points' });
        }

        // Check if the user has rewards recorded
        const totalPoints = results[0].total_points || 0; // Default to 0 if no points are found

        // Return the total points to the user
        res.status(200).json({ user_id, total_points: totalPoints });
    });
});



// Add your API endpoints here (e.g., login, register, log water usage)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
