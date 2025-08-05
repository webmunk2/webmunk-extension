export class Notification {
  public notification: HTMLElement;
  private notificationMessage: HTMLElement;

  constructor() {
    this.notification = document.getElementById('notification')!;
    this.notificationMessage = document.getElementById('notification-message')!;
  }

  private show(message: string, duration: number = 3000, backgroundColor: string): void {
    this.notificationMessage.textContent = message;
    this.notification.style.backgroundColor = backgroundColor;
    this.notification.style.display = 'block';

    setTimeout(() => {
      this.notification.style.display = 'none';
    }, duration);
  }

  public error(message: string, duration: number = 3000): void {
    this.show(message, duration, '#f44336');
  }

  public warning(message: string, duration: number = 3000): void {
    this.show(message, duration, '#ff9800');
  }

  public info(message: string, duration: number = 3000): void {
    this.show(message, duration, '#2196F3');
  }
}