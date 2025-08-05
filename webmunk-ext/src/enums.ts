export enum NotificationText {
  FILL_OUT = 'It`s time to complete a survey. Please click on your extension to continue.',
  REMOVE = 'Please uninstall <a class="open-extensions-link" href="#">the Ad Study extension</a>!'
}

export enum UrlParameters {
  ONLY_INFORMATION = 'oi',
  AD_BLOCKER = 'ab',
  FACEBOOK = 'fad',
  GOOGLE_AND_YOUTUBE = 'gyta',
  AMAZON = 'aap'
}

export enum Event {
  URL_TRACKING = 'url_tracking',
  EXCLUDED_DOMAINS_VISIT = 'excluded_domains_visit',
  INSTALLED_EXTENSIONS = 'installed_extensions',
  USER_MAPPING = 'user_mapping',
  SCREEN_ANALYSIS = 'screen_analysis'
}