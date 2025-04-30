from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import random
import json
import hashlib
from datetime import datetime  # <-- FIXED: Import datetime

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

# Load riddles
with open("static/riddles.json", "r", encoding="utf-8") as f:
    riddles = json.load(f)

@app.get("/", response_class=HTMLResponse)
async def read_root():
    html_path = Path("static/index.html")
    return html_path.read_text(encoding="utf-8")

@app.get("/riddle", response_class=JSONResponse)
async def get_random_riddle():
    riddle = random.choice(riddles)
    return {
        "id": riddle["id"],
        "question": riddle["question"],
        "hint": riddle["hint"]
    }

@app.get("/riddle/daily", response_class=JSONResponse)
async def get_daily_riddle():
    # Simple daily riddle - same for everyone today
    random.seed(int(datetime.now().strftime("%Y%m%d")))  # Now datetime is defined
    daily = random.choice(riddles)
    random.seed()  # Reset random
    return {
        "id": daily["id"],
        "question": daily["question"],
        "hint": daily["hint"]
    }

@app.post("/verify", response_class=JSONResponse)
async def verify_answer(request: Request):
    data = await request.json()
    riddle_id = data.get("riddle_id")
    user_answer = data.get("answer")
    
    if not riddle_id or not user_answer:
        raise HTTPException(status_code=400, detail="Missing riddle_id or answer")
    
    riddle = next((r for r in riddles if r["id"] == riddle_id), None)
    if not riddle:
        raise HTTPException(status_code=404, detail="Riddle not found")
    
    is_correct = hashlib.sha256(user_answer.lower().strip().encode()).hexdigest() == \
                 hashlib.sha256(riddle["answer"].lower().strip().encode()).hexdigest()
    
    return {"correct": is_correct}
