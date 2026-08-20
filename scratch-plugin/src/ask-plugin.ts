import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import '@deepseek-ai/dsh-user-questions'

export const name = 'ask-confirm'
export const inject = ['tools', 'userQuestions']

const description = 'Ask the user to confirm a concrete plan or action before executing it. '
  + 'Call this whenever you are about to carry out a user-visible operation (running a command, '
  + 'modifying files, deploying, sending messages, etc.) and wait for the human verdict: approved '
  + 'means proceed, anything else means stop or revise the plan.'

const APPROVE = '批准'
const REJECT = '拒绝'

export function apply(ctx: Context) {
  ctx.logger('ask-confirm').info('plugin loaded!')
  ctx.tools.register(defineTool({
    name: 'ask',
    description,
    parameters: {
      plan: {
        type: 'string',
        required: true,
        description: 'The concrete plan or action to confirm, as readable markdown; shown to the user for review.',
      },
      question: {
        type: 'string',
        description: 'Optional custom question text; defaults to a standard confirmation.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          approved: { type: 'boolean', required: true, description: 'Whether the user approved the plan.' },
          comment: { type: 'string', description: 'Optional free-text comment from the user.' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const result = await ctx.userQuestions.ask({
        questions: [{
          id: 'confirm',
          question: args.question ?? '是否确认执行以下方案？',
          detail: args.plan,
          options: [
            { label: APPROVE, description: '确认执行该方案' },
            { label: REJECT, description: '不执行该方案，可在备注中说明原因' },
          ],
          intent: { kind: 'plan-review', approve: APPROVE },
        }],
        ...exec.agent !== undefined ? { agent: exec.agent } : {},
        signal: exec.signal,
      })
      const answer = result.answers[0]
      if (answer === undefined) {
        throw new Error('user-questions returned no answer for the confirm question')
      }
      return {
        approved: answer.selected.includes(APPROVE),
        ...answer.custom !== undefined ? { comment: answer.custom } : {},
      }
    },
  }))
}
