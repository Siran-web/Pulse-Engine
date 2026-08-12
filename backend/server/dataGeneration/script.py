from faker import Faker
import random
import pandas as pd
import uuid

fake = Faker()

def generate_patient_record(i):
    age = random.randint(18, 90)
    gender = random.choice(["Male", "Female", "Other"])

    heart_rate = random.randint(60, 130)
    blood_pressure_sys = random.randint(100, 180)
    blood_pressure_dia = random.randint(60, 110)

    visit_count = random.randint(5, 8)
    admission_count = random.randint(2, min(3, visit_count - 1))

    unique_id = str(uuid.uuid4())
    patient_id_enc = f"PT{1000 + i}"
    insurance_id = random.randint(1, 3)
    name_enc = fake.name()

    base_price = 1200
    price = base_price + (heart_rate * 35) + (visit_count * 250) + (admission_count * 150)

    return {
        "unique_id": unique_id,
        "patient_id_enc": patient_id_enc,
        "insurance_id": insurance_id,
        "name_enc": name_enc,
        "age": age,
        "gender_enc": gender,
        "heart_rate": heart_rate,
        "blood_pressure_sys": blood_pressure_sys,
        "blood_pressure_dia": blood_pressure_dia,
        "visit_count": visit_count,
        "admission_count": admission_count,
        "price": price
    }

records = [generate_patient_record(i) for i in range(31,61)]

df = pd.DataFrame(records)
df.to_excel("patient_data.xlsx", index=False)

print("Excel file generated: patient_data.xlsx")