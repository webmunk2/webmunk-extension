import { Notification } from './Notification';
import { SurveyItem, User } from '../types';

class Popup {
  private continueButton: HTMLButtonElement;
  private logInInput: HTMLInputElement;
  private getStartedContainer: HTMLElement;
  private studyExtensionContainer: HTMLElement;
  private copyButton: HTMLButtonElement;
  private formattedIdentifier: HTMLElement;
  private fullIdentifier: string;
  private notification: Notification;

  constructor() {
    this.continueButton = document.getElementById('continueButton') as HTMLButtonElement;
    this.logInInput = document.getElementById('logInInput') as HTMLInputElement;
    this.getStartedContainer = document.getElementById('getStartedContainer') as HTMLElement;
    this.studyExtensionContainer = document.getElementById('studyExtensionContainer') as HTMLElement;
    this.copyButton = document.getElementById('copyButton') as HTMLButtonElement;
    this.formattedIdentifier = document.getElementById('formattedIdentifier') as HTMLElement;
    this.fullIdentifier = '';
    this.notification = new Notification();

    this.init();
  }

  private init(): void {
    this.initListeners();
    this.initView();
  }

  private initListeners(): void {
    this.continueButton.addEventListener('click', () => this.onContinueButtonClick());
    this.copyButton.addEventListener('click', () => this.copyIdentifier());
  }

  private async onContinueButtonClick() {
    const inputValue = this.logInInput.value.trim();

    if (!this.validateInput(inputValue)) {
      return;
    }

    this.setButtonState(true, 'Wait...');

    try {
      const user: User = await this.login(inputValue);

      await chrome.runtime.sendMessage({ action: 'webmunkExt.popup.successRegister' });
      setTimeout(() => this.showStudyExtensionContainer(user.uid), 100);
    } catch (error: any) {
      const message =
        typeof error === 'string'
          ? error
          : 'Enrollment hiccup!\nPlease give it another shot a bit later. We appreciate your patience!';

      this.notification.warning(message);
      this.setButtonState(false, 'Continue');
    }
  }

  private validateInput(inputValue: string): boolean {
    if (!inputValue) {
      this.notification.warning('Please enter a Prolific ID.');
      return false;
    }

    const isValid = this.prolificIdValidation(inputValue);

    if (!isValid) {
      this.notification.warning('Please enter a valid Prolific ID (24 alphanumeric characters).');
      return false;
    }

    return true;
  }

  private async login(prolificId: string): Promise<User> {
    return new Promise((resolve, reject) => {
      const messageHandler = (response: any) => {
        if (response.action === 'webmunkExt.popup.loginRes') {
          chrome.runtime.onMessage.removeListener(messageHandler);

          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.data);
          }
        }
      };

      chrome.runtime.onMessage.addListener(messageHandler);
      chrome.runtime.sendMessage({ action: 'webmunkExt.popup.loginReq', prolificId });
    });
   }

  private async showStudyExtensionContainer(uid: string): Promise<void> {
    this.getStartedContainer.style.display = 'none';
    this.studyExtensionContainer.style.display = 'block';
    this.initSurveys();
    this.formattedIdentifier.innerHTML = this.formatIdentifier(uid);
    this.fullIdentifier = uid;
  }

  private showGetStartedContainer(): void {
    this.getStartedContainer.style.display = 'block';
    this.studyExtensionContainer.style.display = 'none';
  }

  private formatIdentifier(identifier: string): string {
    const firstTenSymbols = identifier.substring(0, 10);
    const lastTenSymbols = identifier.substring(identifier.length - 10);

    return `${firstTenSymbols}...${lastTenSymbols}`;
  }

  private async initView(): Promise<void> {
    const result = await chrome.storage.local.get('user');
    const user = result.user as User;

    user ? await this.showStudyExtensionContainer(user.uid) : this.showGetStartedContainer();
  }

  private async initSurveys(): Promise<void> {
    const result = await chrome.storage.local.get('surveys');
    const surveys: SurveyItem[] = result.surveys || [];
    const taskList = document.getElementById('task-list') as HTMLElement;
    const tasksStatus = document.getElementById('tasks-status') as HTMLElement;

    taskList.innerHTML = '';

    surveys.forEach((survey) => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = survey.url;
      link.textContent = survey.name;
      link.target = '_blank';
      listItem.appendChild(link);
      taskList.appendChild(listItem);
    });

    tasksStatus.textContent = surveys.length ? 'Please complete these tasks:' : 'All tasks are completed!';
  }

  private async copyIdentifier(): Promise<void> {
    await navigator.clipboard.writeText(this.fullIdentifier);
    this.notification.info('Identifier copied to clipboard');
  }

  private setButtonState(isDisabled: boolean, text: string): void {
    this.continueButton.disabled = isDisabled;
    this.continueButton.textContent = text;
  }

  private prolificIdValidation(id: string): boolean {
    const idPattern = /^[a-fA-F0-9]{24}$/;
    return idPattern.test(id);
  }
}

document.addEventListener('DOMContentLoaded', () => new Popup());