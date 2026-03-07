/**
 * XML 工具注册
 * 解析 XML 并路由执行原生动作
 */

import type { Session } from "koishi";
import type { Config, LogFn, OneBotProtocol } from "../../types";
import { sendDeleteMessage } from "../native-tools/tools/delete-msg";
import { sendPoke } from "../native-tools/tools/poke";
import { sendMsgEmoji } from "../native-tools/tools/set-msg-emoji";
import { createXmlInterceptor } from "./interceptor";
import { parseXmlActions } from "./parser";

export interface RegisterXmlToolsDeps {
  ctx: import("koishi").Context;
  config: Config;
  protocol: OneBotProtocol;
  log?: LogFn;
}

export interface XmlToolsRuntime {
  start: () => void;
  stop: () => void;
}

export function registerXmlTools(deps: RegisterXmlToolsDeps): XmlToolsRuntime {
  const { ctx, config, protocol, log } = deps;

  const interceptor = createXmlInterceptor({
    ctx,
    config,
    log,
    onResponse: (response: string, session: Session | null) => {
      const actions = parseXmlActions(response);
      let handled = false;

      if (config.enablePokeXmlTool && actions.pokeUserIds.length > 0) {
        if (!session) {
          log?.("warn", "检测到戳一戳标记但缺少会话上下文");
        } else {
          handled = true;
          for (const userId of actions.pokeUserIds) {
            void sendPoke({ session, userId, protocol, log }).catch((error) => {
              log?.("warn", "XML 触发 poke 失败", error);
            });
          }
        }
      }

      if (config.enableEmojiXmlTool && actions.emojis.length > 0) {
        if (!session) {
          log?.("warn", "检测到表情标记但缺少会话上下文");
        } else {
          handled = true;
          for (const item of actions.emojis) {
            void sendMsgEmoji({
              session,
              messageId: item.messageId,
              emojiId: item.emojiId,
              protocol,
              log,
            }).catch((error) => {
              log?.("warn", "XML 触发表情失败", error);
            });
          }
        }
      }

      if (config.enableDeleteXmlTool && actions.deleteMessageIds.length > 0) {
        if (!session) {
          log?.("warn", "检测到撤回标记但缺少会话上下文");
        } else {
          handled = true;
          for (const messageId of actions.deleteMessageIds) {
            void sendDeleteMessage({ session, messageId, log }).catch(
              (error) => {
                log?.("warn", "XML 触发撤回失败", error);
              },
            );
          }
        }
      }

      return handled;
    },
  });

  return {
    start: () => interceptor.start(),
    stop: () => interceptor.stop(),
  };
}
