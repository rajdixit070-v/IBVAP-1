import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.services.security.ws_ticket_service import WSTicketService

client = TestClient(app)

def test_ws_ticket_issuance_authenticated():
    token = create_access_token('admin', role='admin')
    res = client.post(
        '/api/v1/auth/ws-ticket',
        params={'scope': 'live_feed', 'camera_id': 'CAM-001'},
        headers={'Authorization': f'Bearer {token}'}
    )
    assert res.status_code == 200
    data = res.json()
    assert 'ticket' in data
    assert data['ticket'].startswith('wst_')
    assert data['expires_in_sec'] == 60
    assert data['username'] == 'admin'
    assert data['role'] == 'admin'
    assert data['scope'] == 'live_feed'
    assert data['camera_id'] == 'CAM-001'

def test_ws_ticket_unauthenticated():
    res = client.post('/api/v1/auth/ws-ticket')
    assert res.status_code == 401

def test_ws_ticket_single_use_consumption():
    ticket = WSTicketService.generate_ticket(
        username='test_user',
        role='operator',
        scope='live_feed',
        camera_id='CAM-001'
    )
    consumed_1 = WSTicketService.validate_and_consume_ticket(
        ticket=ticket,
        expected_scope='live_feed',
        expected_camera_id='CAM-001'
    )
    assert consumed_1 is not None
    assert consumed_1['username'] == 'test_user'

    consumed_2 = WSTicketService.validate_and_consume_ticket(
        ticket=ticket,
        expected_scope='live_feed',
        expected_camera_id='CAM-001'
    )
    assert consumed_2 is None

def test_ws_ticket_camera_scope_enforcement():
    ticket = WSTicketService.generate_ticket(
        username='test_user',
        role='operator',
        scope='live_feed',
        camera_id='CAM-001'
    )
    consumed = WSTicketService.validate_and_consume_ticket(
        ticket=ticket,
        expected_scope='live_feed',
        expected_camera_id='CAM-002'
    )
    assert consumed is None

def test_ws_ticket_expiry():
    ticket = WSTicketService.generate_ticket(
        username='test_user',
        role='operator',
        scope='live_feed'
    )
    WSTicketService._tickets[ticket]['expires_at'] = time.time() - 10
    consumed = WSTicketService.validate_and_consume_ticket(
        ticket=ticket,
        expected_scope='live_feed'
    )
    assert consumed is None
