from flask import Flask, request, jsonify, session, render_template
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import database as db

app = Flask(__name__)
app.secret_key = 'budget_secret_key_2024'   # production-da dəyişdirin
CORS(app, supports_credentials=True)

# ── HTML Səhifələri ───────────────────────────────────────────────────────────

@app.route('/')
def root():
    return render_template('login.html')

@app.route('/login.html')
def login_page():
    return render_template('login.html')

@app.route('/index.html')
def index_page():
    return render_template('index.html')

# ── Köməkçi ─────────────────────────────────────────────────────────────────

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Giriş tələb olunur'}), 401
        return f(*args, **kwargs)
    return decorated

# ── Auth ─────────────────────────────────────────────────────────────────────

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'İstifadəçi adı və şifrə tələb olunur'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Şifrə ən az 4 simvol olmalıdır'}), 400

    hashed = generate_password_hash(password)
    success = db.create_user(username, hashed)
    if not success:
        return jsonify({'error': 'Bu istifadəçi adı artıq mövcuddur'}), 409

    return jsonify({'message': 'Qeydiyyat uğurla tamamlandı'}), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = db.get_user_by_username(username)
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'İstifadəçi adı və ya şifrə yanlışdır'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'message': 'Giriş uğurludur', 'username': user['username']}), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Çıxış edildi'}), 200


@app.route('/api/me', methods=['GET'])
@login_required
def me():
    return jsonify({'user_id': session['user_id'], 'username': session['username']}), 200

# ── Transactions ─────────────────────────────────────────────────────────────

@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    transactions = db.get_transactions(session['user_id'])
    return jsonify(transactions), 200


@app.route('/api/income', methods=['POST'])
@login_required
def add_income():
    data = request.get_json()
    amount      = data.get('amount')
    category    = data.get('category', 'Digər')
    description = data.get('description', '')
    date        = data.get('date')

    if not amount or not date:
        return jsonify({'error': 'Məbləğ və tarix tələb olunur'}), 400
    if float(amount) <= 0:
        return jsonify({'error': 'Məbləğ müsbət olmalıdır'}), 400

    db.add_transaction(session['user_id'], 'income', float(amount), category, description, date)
    return jsonify({'message': 'Gəlir əlavə edildi'}), 201


@app.route('/api/expense', methods=['POST'])
@login_required
def add_expense():
    data = request.get_json()
    amount      = data.get('amount')
    category    = data.get('category', 'Digər')
    description = data.get('description', '')
    date        = data.get('date')

    if not amount or not date:
        return jsonify({'error': 'Məbləğ və tarix tələb olunur'}), 400
    if float(amount) <= 0:
        return jsonify({'error': 'Məbləğ müsbət olmalıdır'}), 400

    db.add_transaction(session['user_id'], 'expense', float(amount), category, description, date)
    return jsonify({'message': 'Xərc əlavə edildi'}), 201


@app.route('/api/transaction/<int:tid>', methods=['DELETE'])
@login_required
def delete_transaction(tid):
    db.delete_transaction(tid, session['user_id'])
    return jsonify({'message': 'Silindi'}), 200

# ── Reports ───────────────────────────────────────────────────────────────────

@app.route('/api/balance', methods=['GET'])
@login_required
def balance():
    data = db.get_balance(session['user_id'])
    return jsonify(data), 200


@app.route('/api/report/monthly', methods=['GET'])
@login_required
def monthly_report():
    report = db.get_monthly_report(session['user_id'])
    return jsonify(report), 200

# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    db.init_db()
    app.run(debug=True, port=5000)