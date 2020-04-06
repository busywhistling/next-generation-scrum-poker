import * as React from '/web_modules/react.js';
import { act, render, fireEvent } from '@testing-library/react';
import { App } from './App.js';

const ConfigureMockWebSocket = () => {
  const instances: MockWebSocket[] = [];

  class MockWebSocket {
    onopen?(): void;
    onmessage?(event: MessageEvent): void;
    test_messages: string[] = [];

    constructor(public test_url: string) {
      instances.push(this);
    }

    send(message: string) {
      this.test_messages.push(message);
    }
  }

  window.WebSocket = MockWebSocket as any;
  return instances;
};

describe('The App component', () => {
  it('displays a loading indicator initially', () => {
    const { container } = render(<App />);
    expect(container).toHaveTextContent('Connecting...');
  });

  it('creates a socket connection and displays the login window with an autogemerated session link', () => {
    window.history.pushState({}, 'Test Title', '/');
    const socketInstances = ConfigureMockWebSocket();
    const { container } = render(<App />);
    expect(socketInstances).toHaveLength(1);
    const socket = socketInstances[0];
    expect(socket.test_url).toBe('wss://scrum-poker-backend.playground.aws.tngtech.com');
    expect(typeof socket.onopen).toBe('function');
    expect(typeof socket.onmessage).toBe('function');

    act(() => socket.onopen!());

    expect(container).not.toHaveTextContent('Connecting...');
    expect(container.querySelector('input.user-input')).toBeVisible();
    expect(container.querySelector('a.session-link')).toBeVisible();
    expect(container.querySelector('a.session-link')).toHaveTextContent(/^[a-zA-Z0-9]{16}$/i);
    expect(container.querySelector('input.submit')).toBeVisible();
  });

  it('logs the user in and displays the voting page', () => {
    window.history.pushState({}, 'Test Title', '/xvdBFRA6FyLZFcKo');
    const socketInstances = ConfigureMockWebSocket();
    const { container } = render(<App />);
    const socket = socketInstances[0];

    act(() => socket.onopen!());
    fireEvent.change(container.querySelector('input.user-input')!, {
      target: { value: 'Happy User' },
    });
    fireEvent.click(container.querySelector('input.submit')!);
    expect(socket.test_messages).toEqual([
      '{"message":"sendmessage","data":{"type":"login","payload":{"user":"Happy User","session":"xvdBFRA6FyLZFcKo"}}}',
    ]);

    expect(container).toHaveTextContent('Session ID: xvdBFRA6FyLZFcKo - User name: Happy User');
    expect(container.querySelectorAll('div.card')).toHaveLength(13);
  });
});
