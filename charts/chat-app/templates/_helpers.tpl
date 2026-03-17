{{- define "chat-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "chat-app.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "chat-app.name" . -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "chat-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "chat-app.labels" -}}
helm.sh/chart: {{ include "chat-app.chart" . }}
{{ include "chat-app.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{- define "chat-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chat-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "chat-app.nginxConfigName" -}}
{{- printf "%s-nginx" (include "service-base.fullname" .) -}}
{{- end -}}

{{- define "chat-app.render" -}}
{{- $template := .template -}}
{{- $root := .context -}}
{{- $values := deepCopy $root.Values -}}
{{- $nginx := $values.nginx | default (dict) -}}
{{- $config := $nginx.config | default (dict) -}}
{{- if ($config.enabled | default false) -}}
  {{- $mount := dict "name" "nginx-template" "sourceName" (include "chat-app.nginxConfigName" $root) "type" "configMap" "mountPath" "/etc/nginx/templates/default.conf.template" "subPath" "default.conf.template" "readOnly" true -}}
  {{- $mounts := $values.configMounts | default (list) -}}
  {{- $mounts = append $mounts $mount -}}
  {{- $values = set $values "configMounts" $mounts -}}
{{- end -}}
{{- $ctx := dict "Values" $values "Chart" $root.Chart "Capabilities" $root.Capabilities "Release" $root.Release "Files" $root.Files "Template" $root.Template -}}
{{- include $template $ctx -}}
{{- end -}}
