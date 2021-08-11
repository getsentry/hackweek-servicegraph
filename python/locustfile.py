
import random
from locust import HttpUser, task, between
from provider_names import departments, payment_providers, authentication_providers


class Shopper(HttpUser):
    wait_time = between(0.5, 10)
    host= "http://localhost:5000"
    @task(4)
    def shop(self):
        department = random.choice(departments())
        auth_provider = random.choice(authentication_providers())
        is_authenticated = random.random() < 0.6

        shop_request = {
            "type": "shop",
            "department": department,
            "auth": is_authenticated,
            "auth_provider": auth_provider
        }
        self.client.post("/", json=shop_request)

    @task(1)
    def pay(self):
        payment_provider = random.choice(payment_providers())
        auth_provider = random.choice(authentication_providers())
        is_authenticated = random.random() < 0.6

        pay_request = {
            "type": "pay",
            "payment_provider": payment_provider,
            "auth": is_authenticated,
            "auth_provider": auth_provider
        }
        self.client.post("/", json=pay_request)
