/* eslint-disable @typescript-eslint/no-explicit-any */
import * as github from '@actions/github'
import {afterAll, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {EVENT_NAME_IMAGE_MAP} from '../github/context'
import {OctokitClient} from '../github/types'
import {postMessage} from '../message'
import {SlackClient} from '../slack/client'

describe('postMessage', () => {
  let octokit: OctokitClient
  let slack: SlackClient
  let ts: string | undefined

  const OLD_CONTEXT = github.context
  const OLD_ENV = process.env

  beforeEach(() => {
    octokit = {
      rest: {
        actions: {},
        repos: {}
      }
    } as any

    slack = {
      postMessage: jest.fn(async () => 'TS'),
      updateMessage: jest.fn(async () => undefined)
    } as any

    jest.resetModules()

    process.env = {...OLD_ENV}
    process.env.GITHUB_REPOSITORY = 'namoscato/action-testing'

    github.context.workflow = 'Deploy App'
    github.context.runId = 123
    github.context.eventName = OLD_CONTEXT.eventName
    github.context.payload = OLD_CONTEXT.payload

    jest.useFakeTimers().setSystemTime(new Date('2022-09-10T00:00:15.000Z'))
  })

  afterAll(() => {
    process.env = OLD_ENV

    github.context.eventName = OLD_CONTEXT.eventName
    github.context.payload = OLD_CONTEXT.payload
  })

  describe('first summary pull_request event', () => {
    beforeEach(async () => {
      github.context.eventName = 'pull_request'
      github.context.payload = {
        pull_request: {
          title: 'PR-TITLE',
          number: 1,
          html_url: 'github.com/PR-1',
          head: {
            ref: 'my-pr'
          }
        },
        sender: {
          type: 'user',
          login: 'namoscato',
          avatar_url: 'github.com/namoscato'
        }
      }

      ts = await postMessage(octokit, slack)
    })

    it('should post slack message', () => {
      expect(slack.postMessage).toHaveBeenCalledTimes(1)
      expect(slack.postMessage).toHaveBeenCalledWith({
        icon_url: 'github.com/namoscato',
        username: 'namoscato (via GitHub)',
        unfurl_links: false,
        text: 'Deploying action-testing: PR-TITLE (#1)',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':black_square_button: Deploying *action-testing*: <github.com/PR-1|PR-TITLE (#1)>'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                alt_text: 'pull_request event',
                image_url: EVENT_NAME_IMAGE_MAP['pull_request']
              },
              {
                type: 'mrkdwn',
                text: '<github.com/PR-1/checks|Deploy App>  ∙  my-pr'
              }
            ]
          }
        ]
      })
    })

    it('should return timestamp ID', () => {
      expect(ts).toStrictEqual('TS')
    })
  })

  describe('first summary schedule event', () => {
    beforeEach(async () => {
      github.context.eventName = 'schedule'
      github.context.sha = '05b16c3beb3a07dceaf6cf964d0be9eccbc026e8'

      octokit.rest.repos.getCommit = jest.fn(async () => ({
        data: {
          commit: {
            message:
              'COMMIT-MESSAGE\n\nCo-authored-by: Nick <namoscato@users.noreply.github.com>',
            url: 'github.com/commit'
          }
        }
      })) as any

      ts = await postMessage(octokit, slack)
    })

    it('should fetch commit', () => {
      expect(octokit.rest.repos.getCommit).toHaveBeenCalledWith({
        owner: 'namoscato',
        repo: 'action-testing',
        ref: '05b16c3beb3a07dceaf6cf964d0be9eccbc026e8'
      })
    })

    it('should post slack message', () => {
      expect(slack.postMessage).toHaveBeenCalledTimes(1)
      expect(slack.postMessage).toHaveBeenCalledWith({
        icon_url: 'github.com/namoscato',
        username: 'namoscato (via GitHub)',
        unfurl_links: false,
        text: 'Deploying action-testing: COMMIT-MESSAGE',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':black_square_button: Deploying *action-testing*: <github.com/commit|COMMIT-MESSAGE>'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                alt_text: 'schedule event',
                image_url: EVENT_NAME_IMAGE_MAP['schedule']
              },
              {
                type: 'mrkdwn',
                text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3'
              }
            ]
          }
        ]
      })
    })
  })

  describe('first summary workflow_dispatch event', () => {
    beforeEach(async () => {
      github.context.eventName = 'workflow_dispatch'
      github.context.sha = '05b16c3beb3a07dceaf6cf964d0be9eccbc026e8'

      octokit.rest.repos.getCommit = jest.fn(async () => ({
        data: {
          commit: {
            message: 'COMMIT-MESSAGE',
            url: 'github.com/commit'
          }
        }
      })) as any

      ts = await postMessage(octokit, slack)
    })

    it('should fetch commit', () => {
      expect(octokit.rest.repos.getCommit).toHaveBeenCalledWith({
        owner: 'namoscato',
        repo: 'action-testing',
        ref: '05b16c3beb3a07dceaf6cf964d0be9eccbc026e8'
      })
    })

    it('should post slack message', () => {
      expect(slack.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Deploying action-testing: COMMIT-MESSAGE',
          blocks: expect.arrayContaining([
            {
              type: 'context',
              elements: expect.arrayContaining([
                {
                  type: 'image',
                  alt_text: 'workflow_dispatch event',
                  image_url: EVENT_NAME_IMAGE_MAP['workflow_dispatch']
                }
              ])
            }
          ])
        })
      )
    })
  })

  describe('stage push', () => {
    beforeEach(async () => {
      process.env.INPUT_THREAD_TS = '1662768000' // 2022-09-10T00:00:00.000Z

      github.context.eventName = 'push'
      github.context.job = 'JOB 2'
      github.context.sha = '05b16c3beb3a07dceaf6cf964d0be9eccbc026e8'
      github.context.payload = {
        head_commit: {
          message:
            'COMMIT-MESSAGE\n\nCo-authored-by: Nick <namoscato@users.noreply.github.com>',
          url: 'github.com/commit'
        },
        sender: {
          type: 'user',
          login: 'namoscato',
          avatar_url: 'github.com/namoscato'
        }
      }

      octokit.rest.actions.listJobsForWorkflowRun = jest.fn(async () => ({
        data: {
          jobs: [
            {
              name: 'JOB 1',
              started_at: '2022-09-10T00:00:04.000Z',
              steps: [
                {
                  name: 'Post to Slack',
                  completed_at: '2022-09-10T00:00:05.000Z'
                }
              ]
            },
            {
              name: 'JOB 2',
              started_at: '2022-09-10T00:00:06.000Z',
              steps: [
                {
                  name: 'Run namoscato/action-slack-deploy-pipeline',
                  completed_at: null
                }
              ]
            }
          ]
        }
      })) as any
    })

    describe('intermediate success', () => {
      beforeEach(async () => {
        process.env.INPUT_STATUS = 'success'

        ts = await postMessage(octokit, slack)
      })

      it('should fetch workflow run jobs', () => {
        expect(
          octokit.rest.actions.listJobsForWorkflowRun
        ).toHaveBeenCalledWith({
          owner: 'namoscato',
          repo: 'action-testing',
          run_id: 123
        })
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledTimes(1)
        expect(slack.postMessage).toHaveBeenCalledWith({
          icon_url: 'github.com/namoscato',
          username: 'namoscato (via GitHub)',
          unfurl_links: false,
          text: 'Finished JOB 2',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':white_check_mark: Finished *JOB 2*'
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'image',
                  alt_text: 'push event',
                  image_url: EVENT_NAME_IMAGE_MAP['push']
                },
                {
                  type: 'mrkdwn',
                  text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3  ∙  9 seconds' // from job.started_at = 00:06
                }
              ]
            }
          ],
          reply_broadcast: false,
          thread_ts: '1662768000' // 2022-09-10T00:00:00.000Z
        })
      })

      it('should not update summary message', () => {
        expect(slack.updateMessage).not.toHaveBeenCalled()
      })

      it('should not return timestamp ID', () => {
        expect(ts).toBeUndefined()
      })
    })

    describe('intermediate cancelled', () => {
      beforeEach(async () => {
        process.env.INPUT_STATUS = 'cancelled'

        ts = await postMessage(octokit, slack)
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Cancelled JOB 2',
            blocks: expect.arrayContaining([
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':no_entry_sign: Cancelled *JOB 2*'
                }
              }
            ]),
            reply_broadcast: true
          })
        )
      })

      it('should update summary message', () => {
        expect(slack.updateMessage).toHaveBeenCalledTimes(1)
        expect(slack.updateMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Cancelled deploying action-testing: COMMIT-MESSAGE',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':no_entry_sign: Cancelled deploying *action-testing*: <github.com/commit|COMMIT-MESSAGE>'
                }
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'image',
                    alt_text: 'push event',
                    image_url: EVENT_NAME_IMAGE_MAP['push']
                  },
                  {
                    type: 'mrkdwn',
                    text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3  ∙  15 seconds'
                  }
                ]
              }
            ],
            ts: '1662768000' // 2022-09-10T00:00:00.000Z
          })
        )
      })
    })

    describe('conclusion success', () => {
      beforeEach(async () => {
        process.env.INPUT_STATUS = 'success'
        process.env.INPUT_CONCLUSION = 'true'

        ts = await postMessage(octokit, slack)
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Finished JOB 2',
            reply_broadcast: false
          })
        )
      })

      it('should update summary message', () => {
        expect(slack.updateMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Deployed action-testing: COMMIT-MESSAGE',
            blocks: expect.arrayContaining([
              {
                type: 'context',
                elements: [
                  {
                    type: 'image',
                    alt_text: 'push event',
                    image_url: EVENT_NAME_IMAGE_MAP['push']
                  },
                  {
                    type: 'mrkdwn',
                    text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3  ∙  15 seconds'
                  }
                ]
              }
            ]),
            ts: '1662768000' // 2022-09-10T00:00:00.000Z
          })
        )
      })
    })

    describe('conclusion failed', () => {
      beforeEach(async () => {
        process.env.INPUT_STATUS = 'failure'
        process.env.INPUT_CONCLUSION = 'true'

        ts = await postMessage(octokit, slack)
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Failed JOB 2',
            reply_broadcast: true
          })
        )
      })

      it('should update summary message', () => {
        expect(slack.updateMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Failed deploying action-testing: COMMIT-MESSAGE'
          })
        )
      })
    })

    describe('multiple slack steps in job', () => {
      beforeEach(async () => {
        octokit.rest.actions.listJobsForWorkflowRun = jest.fn(async () => ({
          data: {
            jobs: [
              {
                name: 'JOB 2',
                started_at: '2022-09-10T00:00:04.000Z',
                steps: [
                  {
                    name: 'Post to Slack',
                    completed_at: '2022-09-10T00:00:05.000Z',
                    conclusion: 'success'
                  },
                  {
                    name: 'Post to Slack (skipped)',
                    completed_at: '2022-09-10T00:00:06.000Z',
                    conclusion: 'skipped'
                  },
                  {
                    name: 'Run namoscato/action-slack-deploy-pipeline',
                    completed_at: null
                  }
                ]
              }
            ]
          }
        })) as any

        process.env.INPUT_STATUS = 'success'

        ts = await postMessage(octokit, slack)
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Finished JOB 2',
            blocks: expect.arrayContaining([
              {
                type: 'context',
                elements: [
                  {
                    type: 'image',
                    alt_text: 'push event',
                    image_url: EVENT_NAME_IMAGE_MAP['push']
                  },
                  {
                    text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3  ∙  10 seconds', // from step.completed_at = 00:05
                    type: 'mrkdwn'
                  }
                ]
              }
            ])
          })
        )
      })
    })

    describe('0 second duration', () => {
      beforeEach(async () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-09-10T00:00:06.000Z')) // same as job.started_at = 00:06

        process.env.INPUT_STATUS = 'success'

        ts = await postMessage(octokit, slack)
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Finished JOB 2',
            blocks: expect.arrayContaining([
              {
                type: 'context',
                elements: [
                  {
                    type: 'image',
                    alt_text: 'push event',
                    image_url: EVENT_NAME_IMAGE_MAP['push']
                  },
                  {
                    type: 'mrkdwn',
                    text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3  ∙  0 seconds'
                  }
                ]
              }
            ])
          })
        )
      })
    })
  })

  describe('unsupported event', () => {
    let error: Error

    beforeEach(async () => {
      github.context.eventName = 'issues'

      try {
        await postMessage(octokit, slack)
      } catch (err) {
        error = err as Error
      }
    })

    it('should throw error', () => {
      expect(error.message).toBe(
        'Unsupported "issues" event (currently supported events include: pull_request, push, schedule, workflow_dispatch)'
      )
    })
  })
})
