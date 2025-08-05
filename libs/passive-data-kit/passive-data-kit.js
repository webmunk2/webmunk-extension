/* global chrome, indexedDB, fetch, Blob, nacl */

const pdkFunction = function () {
  const pdk = {}

  pdk.queuedPoints = []
  pdk.lastPersisted = 0

  pdk.openDatabase = function (success, failure) {
    if (pdk.db !== undefined) {
      success(pdk.db)

      return
    }

    const PDK_DATABASE_VERSION = 1

    const request = indexedDB.open('passive_data_kit', PDK_DATABASE_VERSION)

    request.onerror = function (event) {
      failure(event)
    }

    request.onsuccess = function (event) {
      pdk.db = request.result

      success(pdk.db)
    }

    request.onupgradeneeded = function (event) {
      pdk.db = event.target.result

      switch (event.oldVersion) {
        case 0: {
          const dataPoints = pdk.db.createObjectStore('dataPoints', {
            keyPath: 'dataPointId',
            autoIncrement: true
          })

          dataPoints.createIndex('generatorId', 'generatorId', { unique: false })
          dataPoints.createIndex('dataPoint', 'dataPoint', { unique: false })
          dataPoints.createIndex('date', 'date', { unique: false })
          dataPoints.createIndex('transmitted', 'transmitted', { unique: false })
        }
      }
    }
  }

  pdk.persistDataPoints = function (complete) {
    pdk.lastPersisted = Date.now()

    const pendingPoints = pdk.queuedPoints

    pdk.queuedPoints = []

    pdk.openDatabase(function (db) {
      const objectStore = db.transaction(['dataPoints'], 'readwrite').objectStore('dataPoints')

      pendingPoints.forEach(function (point) {
        const request = objectStore.add(point)

        request.onsuccess = function (event) {
          // console.log('[PDK] Data point saved successfully: ' + generatorId + '.')
        }

        request.onerror = function (event) {
          console.log('[PDK] Data point enqueuing failed: ' + point.generatorId + '.')
          console.log(event)
        }
      })

      console.log('[PDK] Data points saved successfully: ' + pendingPoints.length + '.')

      complete()
    }, function (error) {
      if (error) {
        console.log(error)
      }
    })
  }

  pdk.enqueueDataPoint = function (generatorId, dataPoint, complete) {
    if (generatorId !== null && dataPoint !== null) {
      const dataJson = JSON.stringify(dataPoint)

      const payload = {
        generatorId: generatorId, // eslint-disable-line object-shorthand
        dataPoint: JSON.parse(dataJson),
        date: (new Date()).getTime(),
        transmitted: 0
      }

      pdk.queuedPoints.push(payload)
    }

    if (pdk.queuedPoints.length > 0 && (Date.now() - pdk.lastPersisted) > 1000) {
      pdk.persistDataPoints(complete)
    } else {
      complete()
    }
  }

  pdk.currentlyUploading = false

  pdk.uploadProgressCallback = null
  pdk.uploadCompleteCallback = null

  pdk.uploadQueuedDataPoints = function (endpoint, serverKey, progressCallback, completeCallback) {
    if (progressCallback !== null && pdk.uploadProgressCallback === null) {
      pdk.uploadProgressCallback = progressCallback
    }

    if (completeCallback !== null && pdk.uploadCompleteCallback === null) {
      pdk.uploadCompleteCallback = completeCallback
    }

    if (pdk.currentlyUploading) {
      return
    }

    pdk.currentlyUploading = true

    pdk.openDatabase(function (db) {
      const index = db.transaction(['dataPoints'], 'readonly')
        .objectStore('dataPoints')
        .index('transmitted')

      const request = index.getAll(0)

      request.onsuccess = function () {
        const pendingItems = request.result

        if (pendingItems.length === 0) {
          if (pdk.uploadCompleteCallback !== null) {
            pdk.uploadCompleteCallback() // Finished
          }

          pdk.currentlyUploading = false

          pdk.uploadCompleteCallback = null
          pdk.uploadProgressCallback = null
        } else {
          const toTransmit = []
          const xmitBundle = []

          const pendingRemaining = pendingItems.length

          console.log('[PDK] Remaining data points: ' + pendingRemaining)

          if (pdk.uploadProgressCallback !== undefined && pdk.uploadProgressCallback !== null) {
            pdk.uploadProgressCallback(pendingRemaining)
          }

          let bundleLength = 0

          for (let i = 0; i < pendingRemaining && bundleLength < (4 * 1024 * 1024); i++) {
            const pendingItem = pendingItems[i]

            pendingItem.transmitted = new Date().getTime()

            pendingItem.dataPoint.date = pendingItem.date
            pendingItem.dataPoint.generatorId = pendingItem.generatorId

            toTransmit.push(pendingItem)
            xmitBundle.push(pendingItem.dataPoint)

            const bundleString = JSON.stringify(pendingItem.dataPoint)

            bundleLength += bundleString.length
          }

          const status = {
            pending_points: pendingRemaining,
            generatorId: 'pdk-system-status'
          }

          xmitBundle.push(status)

          console.log('[PDK] Created bundle of size ' + bundleLength + '.')

          if (toTransmit.length === 0) {
            pdk.uploadCompleteCallback()

            pdk.currentlyUploading = false

            pdk.uploadCompleteCallback = null
            pdk.uploadProgressCallback = null
          } else {
            chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
              if (result['pdk-identifier'] !== '') {
                pdk.uploadBundle(endpoint, serverKey, result['pdk-identifier'], xmitBundle, function () {
                  pdk.updateDataPoints(toTransmit, function () {
                    pdk.currentlyUploading = false

                    pdk.uploadQueuedDataPoints(endpoint, serverKey, progressCallback, completeCallback)
                  })
                })
              }
            })
          }
        }
      }

      request.onerror = function (event) {
        console.log('[PDK] PDK database error')
        console.log(event)
      }
    })
  }

  pdk.updateDataPoints = function (dataPoints, complete) {
    if (dataPoints.length === 0) {
      complete()
    } else {
      pdk.openDatabase(function (db) {
        const dataPoint = dataPoints.pop()

        const request = db.transaction(['dataPoints'], 'readwrite')
          .objectStore('dataPoints')
          .put(dataPoint)

        request.onsuccess = function (event) {
          pdk.updateDataPoints(dataPoints, complete)
        }

        request.onerror = function (event) {
          console.log('The data has write has failed')
          console.log(event)

          pdk.updateDataPoints(dataPoints, complete)
        }
      }, function (error) {
        console.log(error)

        complete()
      })
    }
  }

  pdk.encryptFields = function (serverKey, localKey, payload) {
    for (const itemKey in payload) {
      const value = payload[itemKey]

      const toRemove = []

      if (itemKey.endsWith('*')) {
        const originalValue = '' + value

        payload[itemKey.replace('*', '!')] = originalValue

        const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
        const messageUint8 = nacl.util.decodeUTF8(JSON.stringify(value))

        const cipherBox = nacl.box(messageUint8, nonce, serverKey, localKey)

        const fullMessage = new Uint8Array(nonce.length + cipherBox.length)

        fullMessage.set(nonce)
        fullMessage.set(cipherBox, nonce.length)

        const base64FullMessage = nacl.util.encodeBase64(fullMessage)

        payload[itemKey] = base64FullMessage

        toRemove.push(itemKey)
      } else if (value != null && value.constructor.name === 'Object') {
        pdk.encryptFields(serverKey, localKey, value)
      } else if (value != null && Array.isArray(value)) {
        value.forEach(function (valueItem) {
          if (valueItem.constructor.name === 'Object') {
            pdk.encryptFields(serverKey, localKey, valueItem)
          }
        })
      }
    }
  }

  pdk.createAttachment = function (dataUrl, uploadedFiles) {
    const dataTokens = dataUrl.split(';')

    if (dataTokens.length < 3) {
      return dataUrl
    }

    const mimeType = dataTokens[0].replace('data:', '')
    let filename = dataTokens[1].replace('name=', '')
    const content = dataTokens[2].replace('base64,', '')

    const byteArray = Uint8Array.from(atob(content).split('').map(char => char.charCodeAt(0)))

    const contentBlob = new Blob([byteArray], {
      type: mimeType
    })

    const fileIndex = 0

    const fileComponents = filename.split('.')

    while (uploadedFiles[filename] !== undefined) {
      const suffix = '-' + fileIndex

      if (fileComponents.length > 1) {
        filename = fileComponents[0] + suffix + '.' + fileComponents[1]
      } else {
        filename = fileComponents[0] + suffix
      }
    }

    uploadedFiles[filename] = contentBlob

    return filename
  }

  pdk.downloadAttachments = function (dataPoint, uploadedFiles) {
    if (dataPoint === null) {
      return
    }

    Object.keys(dataPoint).forEach(function (key) {
      const value = dataPoint[key]

      if (key.endsWith('@')) {
        if (Array.isArray(value)) {
          const replacements = []

          value.forEach(function (item) {
            replacements.push(pdk.createAttachment(item, uploadedFiles))
          })

          dataPoint[key] = replacements
        } else if (typeof value === 'string' || value instanceof String) {
          dataPoint[key] = pdk.createAttachment(value, uploadedFiles)
        }
      } else if (Array.isArray(value)) {
        value.forEach(function (item) {
          pdk.downloadAttachments(item, uploadedFiles)
        })
      } else if (typeof value === 'object') {
        pdk.downloadAttachments(value, uploadedFiles)
      }
    })
  }

  pdk.uploadBundle = function (endpoint, serverKey, userId, points, complete) {
    const manifest = chrome.runtime.getManifest()

    // const keyPair = nacl.box.keyPair()
    // const serverPublicKey = nacl.util.decodeBase64(serverKey)

    const userAgent = manifest.name + '/' + manifest.version + ' ' + navigator.userAgent

    const uploadedFiles = {}

    for (let i = 0; i < points.length; i++) {
      const metadata = {}

      if (points[i].date === undefined) {
        points[i].date = (new Date()).getTime()
      }

      metadata.source = userId
      metadata.generator = points[i].generatorId + ': ' + userAgent
      metadata['generator-id'] = points[i].generatorId
      metadata.timestamp = points[i].date / 1000 // Unix timestamp
      // metadata['generated-key'] = nacl.util.encodeBase64(keyPair.publicKey)
      metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      points[i]['passive-data-metadata'] = metadata

      // pdk.encryptFields(serverPublicKey, keyPair.secretKey, points[i])
      pdk.downloadAttachments(points[i], uploadedFiles)
    }

    const dataString = JSON.stringify(points, null, 2)

    const formData = new FormData()
    formData.append('payload', dataString)

    Object.keys(uploadedFiles).forEach(function (fileKey) {
      formData.append(fileKey, uploadedFiles[fileKey])
    })

    fetch(endpoint, {
      method: 'POST',
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      // headers: {
      //   'Content-Type': 'application/json'
      // },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: formData // body data type must match "Content-Type" header
    })
      .then(response => response.json())
      .then(function (data) {
        complete()
      })
      .catch((error) => {
        console.error('Error:', error)
      })
  }

  return pdk
}
let PDK = pdkFunction();
if (typeof define === 'undefined') {
  if (typeof window !== 'undefined') {
    window.PDK = PDK;
  } 
}
export default PDK;