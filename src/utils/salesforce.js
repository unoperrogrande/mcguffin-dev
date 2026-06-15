import { getToken, getInstanceUrl } from './auth'

const BANKER_USER_ID = '005dL00001n5yjZQAQ'

const apiCall = async (path, options = {}) => {
  const token = getToken()
  const instanceUrl = getInstanceUrl()
  const response = await fetch(`${instanceUrl}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (response.status === 204) return null
  const data = await response.json()
  if (!response.ok) throw new Error(data[0]?.message || 'Salesforce API error')
  return data
}

export const fetchOpportunities = async () => {
  const query = encodeURIComponent(`
    SELECT Id, Name, Account.Name, StageName,
           LastEmailDate__c, LastTextDate__c, LastCallDate__c, LastContactedDate__c
    FROM Opportunity
    WHERE OwnerId = '${BANKER_USER_ID}'
    ORDER BY LastContactedDate__c DESC NULLS LAST
  `)
  const data = await apiCall(`/services/data/v59.0/query?q=${query}`)
  return data.records.map(r => ({
    id: r.Id,
    accountName: r.Account?.Name || r.Name,
    stage: r.StageName,
    lastEmailDate: r.LastEmailDate__c,
    lastTextDate: r.LastTextDate__c,
    lastCallDate: r.LastCallDate__c,
  }))
}

export const updateContactDate = async (oppId, type, dateStr) => {
  const fieldMap = {
    Email: 'LastEmailDate__c',
    Text:  'LastTextDate__c',
    Call:  'LastCallDate__c',
  }
  await apiCall(`/services/data/v59.0/sobjects/Opportunity/${oppId}`, {
    method: 'PATCH',
    body: JSON.stringify({ [fieldMap[type]]: dateStr }),
  })
}