package com.finnri.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class FinnriWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    super.onUpdate(context, manager, ids)
    updateAll(context, manager, ids)
  }

  companion object {
    private const val PREFS = "finnri_widget"

    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, FinnriWidgetProvider::class.java)
      updateAll(context, manager, manager.getAppWidgetIds(component))
    }

    private fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val amount = prefs.getString("amount", context.getString(R.string.widget_amount_default))
      val month = prefs.getString("month", context.getString(R.string.widget_month_default))
      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.widget_finnri)
        views.setTextViewText(R.id.widget_month, month)
        views.setTextViewText(R.id.widget_amount, amount)

        val openIntent = Intent(context, MainActivity::class.java)
        views.setOnClickPendingIntent(
          R.id.widget_summary,
          PendingIntent.getActivity(context, 4201, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        )
        val captureIntent = Intent(context, FinnriCaptureActivity::class.java)
        views.setOnClickPendingIntent(
          R.id.widget_capture,
          PendingIntent.getActivity(context, 4202, captureIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        )
        manager.updateAppWidget(id, views)
      }
    }
  }
}
