import type { Access } from 'payload'

export const authenticated: Access = ({ req }) => Boolean(req.user)

export const authenticatedOrPublished: Access = ({ req }) => {
  if (req.user) return true

  return {
    _status: {
      equals: 'published',
    },
  }
}

export const authenticatedOrPublicMedia: Access = ({ req }) => {
  if (req.user) return true

  return {
    visibility: {
      equals: 'public',
    },
  }
}

export const enabledForPublic: Access = ({ req }) => {
  if (req.user) return true

  return {
    enabled: {
      equals: true,
    },
  }
}

