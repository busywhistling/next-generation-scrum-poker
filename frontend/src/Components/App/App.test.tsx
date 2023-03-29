import { act, fireEvent, render } from '@testing-library/preact';
import { VOTE_NOTE_VOTED } from '../../../../shared/cards';
import { SCALES } from '../../../../shared/scales';
import { ServerMessage } from '../../../../shared/serverMessages';
import { App } from './App';

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

    close() {}
  }

  window.WebSocket = MockWebSocket as unknown as typeof window.WebSocket;
  return instances;
};

const loginUser = () => {
  window.confirm = vi.fn().mockReturnValue(true);
  window.history.pushState({}, 'Test Title', '?sessionId=xvdBFRA6FyLZFcKo');
  const socketInstances = ConfigureMockWebSocket();
  const rendered = render(<App />);
  const socket = socketInstances[0];

  act(() => socket.onopen!());
  fireEvent.input(rendered.container.querySelector('input#user')!, {
    target: { value: 'Happy User' },
  });
  fireEvent.click(rendered.container.querySelector('input[type=submit]')!);

  expect(socket.test_messages).toEqual([
    '{"message":"sendmessage","data":{"type":"login","payload":{"user":"Happy User","session":"xvdBFRA6FyLZFcKo"}}}',
  ]);
  socket.test_messages = [];
  return { socket, ...rendered };
};

const buildEventMessage = (message: ServerMessage): MessageEvent => {
  return { data: JSON.stringify(message) } as MessageEvent;
};

describe('The App component', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(global, 'ResizeObserver', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })),
    });
  });

  it('displays the login screen with a login indicator initially', () => {
    const { container } = render(<App />);
    expect(document.activeElement).toBe(container.querySelector('input#user'));
    expect(container.querySelector('a#session')).toHaveTextContent(/^[a-zA-Z0-9]{16}$/i);
    expect(container.querySelector('input[type=submit]')).toHaveValue('Connecting…');
    expect(container.querySelector('input[type=submit]')).toBeDisabled();
  });

  it('creates a socket connection and displays the login window with an autogenerated session link', () => {
    window.history.pushState({}, 'Test Title', '/');
    const socketInstances = ConfigureMockWebSocket();
    const { container } = render(<App />);
    expect(socketInstances).toHaveLength(1);
    const socket = socketInstances[0];
    expect(socket.test_url).toBe('ws://localhost:8080');
    expect(typeof socket.onopen).toBe('function');
    expect(typeof socket.onmessage).toBe('function');

    act(() => socket.onopen!());

    expect(container.querySelector('input[type=submit]')).toHaveValue('Login');
    expect(container.querySelector('input[type=submit]')).toBeDisabled();

    fireEvent.input(container.querySelector('input#user')!, {
      target: { value: 'Happy User' },
    });
    expect(container.querySelector('input[type=submit]')).not.toBeDisabled();
  });

  it('logs the user in and displays the voting page, then displays the login page if the user is kicked out', () => {
    // given
    const logoutReason = 'You were removed!';
    const { socket, container, getByText } = loginUser();

    expect(getByText(/^Session:/)).toHaveTextContent('Session: xvdBFRA6FyLZFcKo');
    expect(getByText(/^Name:/)).toHaveTextContent('Name: Happy User');
    expect(container.querySelectorAll('button.largeCard')).toHaveLength(14);

    // when
    act(() =>
      socket.onmessage!(
        buildEventMessage({ type: 'not-logged-in', payload: { reason: logoutReason } })
      )
    );

    // then
    expect(container).not.toHaveTextContent('Connecting...');
    expect(container).toHaveTextContent(logoutReason);
    expect(container.querySelector('input#user')).toHaveValue('Happy User');
    expect(container.querySelector('a#session')).toBeVisible();
    expect(container.querySelector('a#session')).toHaveTextContent(/^[a-zA-Z0-9]{16}$/i);
    expect(container.querySelector('input[type=submit]')).toBeVisible();
  });

  it('updates, reveals and resets votes and kicks optimistically once the first state message arrived', () => {
    // given
    const { socket, container, getByRole, getAllByTitle, getByText } = loginUser();

    // then
    const revealButton = getByRole('button', { name: 'Connecting…' });
    expect(revealButton).toBeDisabled();
    container.querySelectorAll('button.largeCard').forEach((card) => expect(card).toBeDisabled());
    getAllByTitle(/^Kick/).forEach((button) => expect(button).toBeDisabled());
    expect(getByRole('combobox')).toBeDisabled();

    // when
    act(() =>
      socket.onmessage!(
        buildEventMessage({
          type: 'state',
          payload: {
            votes: {
              'Happy User': VOTE_NOTE_VOTED,
              'Voting User': '13',
              'Non-voting User': VOTE_NOTE_VOTED,
            },
            resultsVisible: false,
            scale: SCALES.COHEN_SCALE.values,
          },
        })
      )
    );

    // then
    expect(revealButton).toBeEnabled();
    container.querySelectorAll('button.largeCard').forEach((card) => expect(card).toBeEnabled());
    getAllByTitle(/^Kick/).forEach((button) => expect(button).toBeEnabled());
    expect(getByRole('combobox')).toBeEnabled();

    // when
    const selectedCard = container.querySelectorAll('button.largeCard')[5];

    // then
    expect(selectedCard).toHaveTextContent('2');
    expect(selectedCard).not.toHaveClass('selectedCard');
    expect(container.querySelector('tbody')).toHaveTextContent(
      'Happy UserNon-voting UserVoting User'
    );

    // when
    fireEvent.click(container.querySelectorAll('button.largeCard')[5]);

    // then
    expect(selectedCard).toHaveClass('selected');
    expect(container.querySelector('tbody')).toHaveTextContent(
      'Non-voting UserHappy UserVoting User'
    );
    expect(socket.test_messages).toEqual([
      '{"message":"sendmessage","data":{"type":"set-vote","payload":{"vote":"2"}}}',
    ]);
    socket.test_messages = [];

    // when
    fireEvent.click(getByRole('button', { name: 'Kick Non-voting User' }));

    // then
    expect(container.querySelector('tbody')).toHaveTextContent('Happy UserVoting User');
    expect(socket.test_messages).toEqual([
      '{"message":"sendmessage","data":{"type":"remove-user","payload":{"user":"Non-voting User"}}}',
    ]);
    socket.test_messages = [];

    // when
    expect(revealButton).toHaveTextContent('Reveal Votes');
    fireEvent.click(revealButton);

    // then
    expect(container.querySelector('tbody')).toHaveTextContent('Happy User2Voting User13');
    expect(socket.test_messages).toEqual([
      '{"message":"sendmessage","data":{"type":"reveal-votes"}}',
    ]);
    socket.test_messages = [];

    // when
    fireEvent.click(getByRole('button', { name: 'Reset votes' }));

    // then
    expect(container.querySelector('tbody')).toHaveTextContent('Happy UserVoting User');
    expect(socket.test_messages).toEqual([
      '{"message":"sendmessage","data":{"type":"reset-votes"}}',
    ]);
  });
});
