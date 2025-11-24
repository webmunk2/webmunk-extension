import { RateType } from '../enums';

export class RateService {
  constructor() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    if (message.action === 'webmunkExt.rateService.adRatingRequest') {
      this.showAdRatingNotification(message.timestamp, message.type);
    }
  }

  private showAdRatingNotification(timestamp: string, type: RateType): void {
    if (document.getElementById('webmunk-rate-notification')) return;

    this.removeSurveyNotificationIfExist();

    const styles = document.createElement('style');
    styles.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');

      .notification-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 10000;

        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;

        pointer-events: none;
      }

      .notification-container {
        position: fixed;
        z-index: 10000;

        display: flex;
        flex-direction: column;
        gap: 15px;
        width: 450px;
        padding: 15px 20px;

        background-color: #ffffff;
        border: 1px solid transparent;
        color: black;
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 700 !important;
        border-radius: 10px;
        opacity: 0;
        box-shadow:  0 0 10px rgba(0,0,0,0.2);
        animation: appear 0.5s linear forwards;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        pointer-events: all;
      }

      @keyframes appear {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 0.8;
        }
      }

      input {
        appearance: unset;
      }

      .star {
        transition: color 0.3s;
        color: lightgray;
      }

      .star:before {
        content: '\\2605';
        font-size: 30px;
        cursor: pointer;
      }

      input:checked ~ .star,
      .star:hover,
      .star:hover ~ .star {
        color: orange;
        transition: color 0.3s;
      }

      input:checked ~ .star {
        transition: 0s;
        animation: scale 0.75s backwards;
      }

      @keyframes scale {
        0% {
          transform: scale(1);
        }

        30% {
          transform: scale(0);
        }

        60% {
          transform: scale(1.2);
        }
      }

      .close-button {
        background-color: transparent;
        cursor: pointer;
        fill: black;

        &:hover {
          fill: rgb(175, 175, 175);
        }
      }

      .response-btn {
        padding: 10px 20px;
        height: 35px;
        max-width: 130px;
        display: flex;
        justify-content: center;
        align-items: center;

        border: 2px solid black;
        color: black;
        background-color: white;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.3s, color 0.3s;
        border-radius: 20px;
      }

      .response-btn.active {
        background-color: black;
        color: white;
        border-color: black;
      }

      .response-btn:hover:not(.active) {
        background-color: #f0f0f0;
      }
    `;

    document.head.appendChild(styles);
    const wrapper = document.createElement('div');
    wrapper.classList.add('notification-wrapper');
    wrapper.id = 'webmunk-rate-notification';

    const notificationContainer = document.createElement('div');
    notificationContainer.classList.add('notification-container');
    const answer = this.getAnswer(type);

    const notificationContent = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img style="width: 25px; height: 25px;" src="${chrome.runtime.getURL('images/favicon.png')}" alt="logo">
          <p style="font-size: 20px; color: black; margin: 0; line-height: 1.3;">Ad Study Survey</p>
        </div>
        <svg id="rate-close-button" class="close-button" height="20px" viewBox="0 0 384 512">
          <path
            d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"
          >
          </path>
        </svg>
      </div>
      <p style="font-size: 18px; color: black; margin: 0; line-height: 1.3;">How would you describe the ads on this site?</p>
      <div class="response-buttons" style="display: flex; align-items: center; justify-content: space-between;">
        <button class="response-btn">${answer}</button>
        <button class="response-btn">Not ${answer}</button>
        <button class="response-btn">No Ads Seen</button>
      </div>
    `;
    notificationContainer.innerHTML = notificationContent;
    wrapper.appendChild(notificationContainer);
    document.documentElement.appendChild(wrapper);

    document.getElementById('rate-close-button')!.addEventListener('click', () => {
      this.sendResponseToService('skip', timestamp);
      wrapper.remove();
    });

    document.querySelectorAll('.response-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const answer = target.textContent;

        target.classList.add('active');

        wrapper.remove();
        if (answer) this.sendResponseToService(answer, timestamp);
      });
    });
  }

  private getAnswer(type: RateType): string {
    return type === RateType.relevance ? 'Relevant' : 'Distracting';
  }

  private sendResponseToService(response: string, timestamp: string): void {
    chrome.runtime.sendMessage({
      action: `webmunkExt.rateService.adRatingResponse_${timestamp}`,
      response
    });
  }

  private removeSurveyNotificationIfExist(): void {
    const surveyNotification = document.getElementById('webmunk-notification');

    surveyNotification && surveyNotification.remove();
  }
}
