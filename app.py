import sqlite3
import string
import random
from flask import Flask, render_template, request, jsonify, redirect, url_for

app = Flask(__name__)

# Function to create a unique ID
def generate_id(length=8):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for i in range(length))

# Set up the database
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invitations (
            id TEXT PRIMARY KEY,
            couple_name1 TEXT,
            couple_name2 TEXT,
            date TEXT,
            location TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS guests (
            id TEXT PRIMARY KEY,
            invitor_id TEXT,
            name TEXT,
            status TEXT,
            FOREIGN KEY (invitor_id) REFERENCES invitations(id)
        )
    ''')
    conn.commit()
    conn.close()

# Main invitor page
@app.route('/', methods=['GET', 'POST'])
def invitor_page():
    if request.method == 'POST':
        data = request.json
        invitor_id = generate_id()
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO invitations (id, couple_name1, couple_name2, date, location)
            VALUES (?, ?, ?, ?, ?)
        ''', (invitor_id, data['coupleName1'], data['coupleName2'], data['date'], data['location']))
        conn.commit()
        conn.close()
        return jsonify({'invitorId': invitor_id})
    return render_template('invitor.html')

# Invitee page
@app.route('/<invitor_id>')
def invitee_page(invitor_id):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    invitation = cursor.execute('SELECT * FROM invitations WHERE id = ?', (invitor_id,)).fetchone()
    conn.close()
    if invitation:
        invitation_data = {
            'coupleName1': invitation[1],
            'coupleName2': invitation[2],
            'date': invitation[3],
            'location': invitation[4]
        }
        return render_template('invitee.html', invitation=invitation_data, invitor_id=invitor_id)
    return "Invitation not found.", 404

# API to handle guest RSVPs
@app.route('/api/rsvp', methods=['POST'])
def handle_rsvp():
    data = request.json
    invitor_id = data['invitorId']
    guest_name = data['guestName']
    status = data['status']
    guest_id = generate_id()

    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO guests (id, invitor_id, name, status)
        VALUES (?, ?, ?, ?)
    ''', (guest_id, invitor_id, guest_name, status))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'guestId': guest_id})

# API to get guest list for invitor
@app.route('/api/guests/<invitor_id>')
def get_guests(invitor_id):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    guests = cursor.execute('SELECT name, status FROM guests WHERE invitor_id = ?', (invitor_id,)).fetchall()
    conn.close()
    guest_list = [{'name': g[0], 'status': g[1]} for g in guests]
    return jsonify(guest_list)

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
