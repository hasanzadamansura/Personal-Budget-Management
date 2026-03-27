class User:
    def __init__(self, id, username, created_at):
        self.id = id
        self.username = username
        self.created_at = created_at

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'created_at': self.created_at
        }


class Transaction:
    def __init__(self, id, user_id, type, amount, category, description, date, created_at=None):
        self.id = id
        self.user_id = user_id
        self.type = type            # 'income' or 'expense'
        self.amount = amount
        self.category = category
        self.description = description
        self.date = date
        self.created_at = created_at

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'amount': self.amount,
            'category': self.category,
            'description': self.description,
            'date': self.date,
            'created_at': self.created_at
        }
